// คน A: แก้ชื่อ คำอธิบาย รูป และแต้มด้านล่าง แล้วรีเฟรชเว็บ
window.MONSTERS.push({
  id: "monster-a", // ไม่ต้องเปลี่ยน ID
  name: "แมวไฟขี้เซาา",
  description: "ชอบนอนกลางแดด แต่จะพ่นไฟเมื่อหิว",
  image: "assets/monster-a.svg", // ใส่รูปของตัวเองใน assets/ 
  skill: "strike", // strike | poison | heal | shield (ทุก 3 ตาตัวเอง)
  trait: "berserk", // none | thorns | regeneration | berserk
  stats: {
    // งบรวมสูงสุด 100 แต้ม เว็บ cap ค่าที่เกินให้อัตโนมัติ
    hp: 30, // สูงสุด 50
    attack: 25,
    defense: 15,
    speed: 10, // attack / defense / speed สูงสุดอย่างละ 40
    critical: 10, // โอกาสคริติคอล % สูงสุด 25
    lifesteal: 10, // ดูดเลือด % สูงสุด 20
    evasion: 0, // หลบหลีก % สูงสุด 20
    armorPierce: 0 // เจาะเกราะ % สูงสุด 30
  }
});
