// ตัวอย่างสำหรับอ้างอิง ไฟล์นี้ไม่ได้โหลดเป็นมอนสเตอร์ในหน้าเว็บ
// ในเวิร์กช็อปให้แก้ monster-a.js หรือ monster-b.js ที่เตรียมไว้แล้ว
window.MONSTERS.push({
  id: "unique-monster-id", // ถ้าจะเพิ่มตัวใหม่ ID ต้องไม่ซ้ำ
  name: "ชื่อมอนสเตอร์ของคุณ",
  description: "นิสัยหรือเรื่องราวสั้น ๆ",
  image: "assets/placeholder.svg", // PNG, JPG, SVG หรือ WebP ใน assets/
  skill: "heal", // strike | poison | heal | shield ใช้ทุก 3 ตาตัวเอง
  trait: "none", // none | thorns | regeneration | berserk
  stats: {
    // งบรวม 100 เว็บจำกัดรายค่าและลดตามสัดส่วนเมื่อเกินงบ
    hp: 25, // สูงสุด 50
    attack: 20, // สูงสุด 40
    defense: 15, // สูงสุด 40
    speed: 15, // สูงสุด 40
    critical: 10, // สูงสุด 25
    lifesteal: 5, // สูงสุด 20
    evasion: 5, // สูงสุด 20
    armorPierce: 5 // สูงสุด 30
  }
});
