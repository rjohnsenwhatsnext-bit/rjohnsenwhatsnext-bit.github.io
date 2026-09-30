// The ragdoll pilot (Ryan, 28 Sep 2026: "add the ragdoll guy and give it
// controls"). A little figure standing on the plane. He is drawn from seven
// points joined by sticks: riding, each point is pulled towards his pose
// (shifted by how far he is leaning, the same offset the flight physics uses)
// and swings with the plane's turns; thrown off, the points fall freely,
// tumbling and bouncing on the floor. Visuals only: his weight and the lean
// are in the flight engine (flight.lean, riderAt).
//
// Local frame while riding = the plane's body frame: x nose, y up, z right.

const POSE = {
  footL: [0, 0, -0.008],
  footR: [0, 0, 0.008],
  kneeL: [0.007, 0.011, -0.009],
  kneeR: [0.007, 0.011, 0.009],
  pelvis: [0, 0.022, 0],
  chest: [0.002, 0.037, 0],
  head: [0.003, 0.05, 0],
  handL: [0.002, 0.034, -0.024],
  handR: [0.002, 0.034, 0.024],
  elbowL: [-0.003, 0.032, -0.014],
  elbowR: [-0.003, 0.032, 0.014],
};
const NAMES = Object.keys(POSE);
const STICKS = [
  ['footL', 'kneeL'], ['kneeL', 'pelvis'],
  ['footR', 'kneeR'], ['kneeR', 'pelvis'],
  ['pelvis', 'chest'],
  ['chest', 'head'],
  ['chest', 'elbowL'], ['elbowL', 'handL'],
  ['chest', 'elbowR'], ['elbowR', 'handR'],
];
const JOINT = { head: 0.0075, pelvis: 0.0045, chest: 0.005 };
// drawn larger than life so he reads on a phone; his weight in the physics is unchanged
const K = 1.7;

export function createRider(THREE, scene, planeGroup) {
  const skin = new THREE.MeshStandardMaterial({ color: '#f1c9a0', roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: '#b87536', roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: '#27313a', roughness: 0.9 });
  const group = new THREE.Group();
  group.name = 'ragdoll-pilot';
  planeGroup.add(group);
  const joints = {};
  for (const n of NAMES) {
    const m = new THREE.Mesh(new THREE.SphereGeometry((JOINT[n] || 0.0033) * K, 10, 8), n === 'head' || n.startsWith('hand') ? skin : n.startsWith('foot') ? pants : shirt);
    m.castShadow = true;
    group.add(m);
    joints[n] = m;
  }
  const bone = new THREE.CylinderGeometry(0.0024 * K, 0.0024 * K, 1, 6);
  const bones = STICKS.map(([a, b]) => {
    const m = new THREE.Mesh(bone, /foot|knee/.test(a) ? pants : shirt);
    m.castShadow = true;
    group.add(m);
    return { a, b, m };
  });
  const rest = STICKS.map(([a, b]) => K * Math.hypot(...POSE[a].map((v, i) => v - POSE[b][i])));

  // A little stitched toy aviator. Native geometry keeps the silhouette crisp
  // from any camera angle and follows the same joint simulation as the limbs.
  const leather = new THREE.MeshStandardMaterial({color:'#4b3024',roughness:.85});
  const wool = new THREE.MeshStandardMaterial({color:'#fff0c8',roughness:1});
  const brass = new THREE.MeshStandardMaterial({color:'#e5b85f',metalness:.65,roughness:.3});
  const lens = new THREE.MeshStandardMaterial({color:'#386f78',metalness:.5,roughness:.17});
  const silk = new THREE.MeshStandardMaterial({color:'#b72e31',roughness:.8,side:THREE.DoubleSide});
  function ellipsoid(parent,mat,x,y,z,sx,sy,sz){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);
    mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  const headgear=new THREE.Group();group.add(headgear);
  ellipsoid(headgear,leather,-.002,.004,0,.013,.012,.014);
  for(const sign of [-1,1]){
    ellipsoid(headgear,leather,0,-.002,sign*.012,.007,.009,.004);
    ellipsoid(headgear,brass,.011,.002,sign*.006,.004,.0055,.0055);
    ellipsoid(headgear,lens,.014,.002,sign*.006,.002,.004,.004);
  }
  ellipsoid(headgear,skin,.014,-.004,0,.004,.003,.003);
  const torso=new THREE.Group();group.add(torso);
  ellipsoid(torso,shirt,0,0,0,.010,.016,.014);
  ellipsoid(torso,wool,0,.012,0,.011,.005,.015);
  const zip=new THREE.Mesh(new THREE.BoxGeometry(.0015,.019,.0017),brass);zip.position.set(.010,0,0);torso.add(zip);
  for(const n of ['footL','footR'])ellipsoid(joints[n],leather,.003,0,0,.010,.005,.006);
  for(const n of ['handL','handR'])joints[n].material=leather;
  const scarf=new THREE.Mesh(new THREE.PlaneGeometry(.048,.008,6,1),silk);
  scarf.geometry.rotateX(Math.PI/2);group.add(scarf);
  const scarfBase=scarf.geometry.attributes.position.array.slice();
  let flutter=0;
  const tempA=new THREE.Vector3(),tempB=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);

  let seat = [0, 0.01, 0];
  let side = 0.06;
  let reach = 0.02;
  let pts = null; // [{p, old}] in the current frame
  let mode = 'riding'; // or 'falling'
  let flightSeen = null;
  let lastVel = null;
  let previousH = 1 / 60;

  const target = (n, lean) => {
    const q = POSE[n];
    return [seat[0] + q[0] * K + lean[0] * reach, seat[1] + q[1] * K, seat[2] + q[2] * K + lean[1] * side];
  };
  function resetRiding(lean = [0, 0]) {
    if (group.parent !== planeGroup) planeGroup.add(group);
    mode = 'riding';
    pts = NAMES.map((n) => {
      const p = target(n, lean);
      return { p: p.slice(), old: p.slice() };
    });
    lastVel = null;
  }
  function constrain(iter = 4) {
    for (let k = 0; k < iter; k++) {
      STICKS.forEach(([a, b], i) => {
        const A = pts[NAMES.indexOf(a)].p;
        const B = pts[NAMES.indexOf(b)].p;
        const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
        const l = Math.hypot(...d) || 1e-6;
        const f = (l - rest[i]) / l / 2;
        for (let j = 0; j < 3; j++) {
          A[j] += d[j] * f;
          B[j] -= d[j] * f;
        }
      });
    }
  }
  function render() {
    NAMES.forEach((n, i) => joints[n].position.fromArray(pts[i].p));
    for (const b of bones) {
      const A = new THREE.Vector3().fromArray(pts[NAMES.indexOf(b.a)].p);
      const B = new THREE.Vector3().fromArray(pts[NAMES.indexOf(b.b)].p);
      const d = B.clone().sub(A);
      b.m.position.copy(A).add(B).multiplyScalar(0.5);
      b.m.scale.set(1, Math.max(d.length(), 1e-4), 1);
      b.m.quaternion.setFromUnitVectors(up, d.normalize());
    }
    headgear.position.copy(joints.head.position);
    tempA.copy(joints.head.position).sub(joints.chest.position).normalize();
    headgear.quaternion.setFromUnitVectors(up,tempA);
    torso.position.copy(joints.chest.position).add(joints.pelvis.position).multiplyScalar(.5);
    tempB.copy(joints.chest.position).sub(joints.pelvis.position).normalize();
    torso.quaternion.setFromUnitVectors(up,tempB);
    scarf.position.copy(joints.chest.position);scarf.position.x-=.025;
    const pos=scarf.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){const x=scarfBase[i*3],tail=(.024-x)/.048;pos.setXYZ(i,x,scarfBase[i*3+1]+Math.sin(flutter*14+tail*5)*.005*tail,scarfBase[i*3+2]+Math.sin(flutter*9+tail*4)*.003*tail);}
    pos.needsUpdate=true;scarf.geometry.computeVertexNormals();
  }

  function setSeat(s, sizes = {}) {
    seat = s;
    if (sizes.side) side = sizes.side;
    if (sizes.reach) reach = sizes.reach;
    resetRiding();
    render();
  }

  // called every frame by the scene, after the plane is placed
  function update(flight, dt) {
    if (!pts) resetRiding();
    if (flight !== flightSeen) {
      flightSeen = flight;
      resetRiding();
    }
    const rd = flight?.state.rider;
    const lean = rd?.lean || [0, 0];
    group.visible=planeGroup.visible;
    if(dt<=0){render();return;} // Pause freezes the pilot as well as the plane.
    const h = Math.min(dt, 1 / 30);
    flutter+=h;
    if (mode === 'riding' && rd && !rd.on) {
      // thrown off: carry every point into the world, moving as he was
      planeGroup.updateMatrixWorld(true);
      const v = rd.lost.vel;
      pts = pts.map(({ p }) => {
        const w = planeGroup.localToWorld(new THREE.Vector3(...p)).toArray();
        const o = [w[0] - v[0] * h, w[1] - v[1] * h, w[2] - v[2] * h];
        return { p: w, old: o };
      });
      scene.add(group);
      mode = 'falling';
      previousH=h;
    }
    if (mode === 'riding') {
      // the plane's acceleration, felt in its own frame, swings him about
      let push = [0, 0, 0];
      if (flight && lastVel && h > 0) {
        const a = flight.state.vel.map((x, i) => (x - lastVel[i]) / h);
        const inv = planeGroup.quaternion.clone().invert();
        const ab = new THREE.Vector3(a[0], a[1] + 9.81, a[2]).applyQuaternion(inv);
        push = [-ab.x * 0.0004, -(ab.y - 9.81) * 0.0004, -ab.z * 0.0004];
      }
      lastVel = flight ? flight.state.vel.slice() : null;
      NAMES.forEach((n, i) => {
        const q = pts[i];
        const t = target(n, lean);
        const stiff = n.startsWith('foot') ? 1 : n.startsWith('hand') ? 0.18 : 0.35;
        for (let j = 0; j < 3; j++) {
          const vel = (q.p[j] - q.old[j]) * Math.pow(0.8,h*60) * h / previousH;
          q.old[j] = q.p[j];
          q.p[j] += vel + (t[j] - q.p[j]) * (1-Math.pow(1-stiff,h*60)) + (n.startsWith('foot') ? 0 : push[j]*h*60);
        }
      });
      constrain();
      // feet stay planted where he stands
      for (const n of ['footL', 'footR']) pts[NAMES.indexOf(n)].p = target(n, lean);
    } else {
      // free fall, air drag, and the floor
      for (const q of pts) {
        for (let j = 0; j < 3; j++) {
          const vel = (q.p[j] - q.old[j]) * Math.pow(0.995,h*60) * h / previousH;
          q.old[j] = q.p[j];
          q.p[j] += vel + (j === 1 ? -9.81 * h * h : 0);
        }
        if (q.p[1] < 0.02) {
          const vy = q.p[1] - q.old[1];
          q.p[1] = 0.02;
          q.old[1] = q.p[1] + vy * 0.3;
          q.old[0] = q.p[0] - (q.p[0] - q.old[0]) * 0.6;
          q.old[2] = q.p[2] - (q.p[2] - q.old[2]) * 0.6;
        }
      }
      constrain(6);
      for(const q of pts)q.p[1]=Math.max(.02,q.p[1]);
    }
    previousH=h;
    render();
  }
  return { group, setSeat, update, reset: () => resetRiding() };
}
