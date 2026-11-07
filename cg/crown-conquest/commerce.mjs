// Commerce intentionally remains closed until Claude connects an authenticated,
// authoritative economy. A browser flag cannot safely authorize real purchases.
export const commerce={ready:false,reason:'Real-money purchases are not live yet. All gameplay unlocks can be earned with XP.',async purchase(){throw new Error(this.reason);},async restore(){return {message:'No billing account is connected yet.'};}};
