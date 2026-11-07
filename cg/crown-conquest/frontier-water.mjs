// World-space river geometry keeps animated water attached to the landscape.
export function frontierWater(){
 const course='M 555 -50 C 650 75 535 125 575 210 S 715 330 655 390 S 490 485 550 580 S 540 720 455 850';
 const ripples=Array.from({length:100},(_,i)=>{const x=480+(Math.sin(i*127.1)*.5+.5)*225,y=(i*67.31)%850;return `<path d="M${x} ${y}q5 -2 12 0"/>`;}).join('');
 return `<svg class="frontier-water" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true">
 <defs><linearGradient id="river-depth" x2=".7" y2="1"><stop stop-color="#619896"/><stop offset=".45" stop-color="#28535d"/><stop offset="1" stop-color="#498986"/></linearGradient>
 <filter id="bank-wear" x="-15%" y="-5%" width="130%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="9" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="G"/></filter>
 <filter id="water-grain"><feTurbulence type="fractalNoise" baseFrequency=".13 .45" numOctaves="2" seed="4"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="soft-light"/></filter>
 <path id="river-course" d="${course}"/>
 <mask id="river-mask"><use href="#river-course" fill="none" stroke="white" stroke-width="30" filter="url(#bank-wear)"/></mask></defs>
 <g fill="none" filter="url(#bank-wear)">
 <use href="#river-course" stroke="#344332" stroke-opacity=".65" stroke-width="49"/>
 <use href="#river-course" stroke="#8c8a62" stroke-width="42"/>
 <use href="#river-course" stroke="#75978a" stroke-width="35"/>
 <use href="#river-course" stroke="url(#river-depth)" stroke-width="30"/>
 </g>
 <g mask="url(#river-mask)"><rect x="450" y="0" width="275" height="800" opacity=".19" filter="url(#water-grain)" fill="#438480"/>
 <g class="river-ripples" fill="none" stroke="#c0eee0" stroke-opacity=".28" stroke-width=".7">${ripples}</g></g>
 <g stroke="#514c36" stroke-width="3" fill="#ad9870"><path d="M 561 218 L 608 191 L 624 218 L 577 245 Z"/><path d="M 524 567 L 572 546 L 586 578 L 538 599 Z"/></g>
 <g stroke="#d4c395" stroke-width="2"><path d="M570 223l44-25m-39 33l44-25m-39 33l44-25M533 573l42-18m-38 26l42-18m-38 26l42-18"/></g>
 </svg>`;
}
