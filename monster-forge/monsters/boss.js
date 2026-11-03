// รอบ 2: ทั้งสองคนเปลี่ยนบรรทัด name เดียวกันให้เป็นคนละชื่อ
window.MONSTERS.push({
  id: "final-boss",
  name: "บอสลึกลับ",
  description: "บอสที่ทั้งสองคนต้องช่วยกันออกแบบ",
  image: "assets/boss.svg",
  enabled: false, // เปลี่ยนเป็น true เพื่อเปิดบอส
  skill: "shield", // strike | poison | heal | shield
  trait: "thorns", // none | thorns | regeneration | berserk
  stats: {
    // หลังแก้ Conflict ต้องเหลือบอสเดียว งบรวมสูงสุด 100
    hp: 30, // สูงสุด 50
    attack: 25,
    defense: 20,
    speed: 10, // attack / defense / speed สูงสุดอย่างละ 40
    critical: 0, // สูงสุด 25
    lifesteal: 0, // สูงสุด 20
    evasion: 0, // สูงสุด 20
    armorPierce: 15 // สูงสุด 30
  }
});
