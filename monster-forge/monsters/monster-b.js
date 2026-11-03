// คน B: แก้ชื่อ คำอธิบาย รูป และแต้มด้านล่าง แล้วรีเฟรชเว็บ
window.MONSTERS.push({
  id: "monster-b", // ไม่ต้องเปลี่ยน ID
  name: "สไลม์สายฟ้า",
  description: "ตัวนุ่มนิ่ม วิ่งไว และชอบแอบชาร์จไฟ",
  image: "assets/monster-b.svg", // ใช้ชื่อรูปไม่ซ้ำกับเพื่อน
  skill: "poison", // strike | poison | heal | shield (ทุก 3 ตาตัวเอง)
  trait: "regeneration", // none | thorns | regeneration | berserk
  stats: {
    // งบรวมสูงสุด 100 แต้ม ค่าเกินเพดานจะถูกลดในเว็บ
    hp: 20, // สูงสุด 50
    attack: 25,
    defense: 10,
    speed: 25, // attack / defense / speed สูงสุดอย่างละ 40
    critical: 10, // สูงสุด 25
    lifesteal: 0, // สูงสุด 20
    evasion: 10, // สูงสุด 20
    armorPierce: 0 // สูงสุด 30
  }
});
