"use strict";
window.MONSTERS = [];

window.ForgeData = (function () {
  const budget = 100;
  const limits = { hp: 50, attack: 40, defense: 40, speed: 40, critical: 25, lifesteal: 20, evasion: 20, armorPierce: 30 };
  const labels = { hp: "HP", attack: "ATK", defense: "DEF", speed: "SPD", critical: "คริติคอล", lifesteal: "ดูดเลือด", evasion: "หลบหลีก", armorPierce: "เจาะเกราะ" };
  const statKeys = Object.keys(limits);
  const descriptions = {
    hp: "เพิ่ม HP สูงสุด: 80 + HP × 3", attack: "เพิ่มความเสียหายพื้นฐาน", defense: "ลดความเสียหายที่ได้รับ", speed: "เริ่มก่อนเมื่อเร็วกว่า และเพิ่มโอกาสหลบเล็กน้อย",
    critical: "โอกาสคริติคอลตามแต้มเป็น % แรง 1.5 เท่า", lifesteal: "ฟื้น HP ตาม % ของความเสียหายที่เข้าถึงเลือดจริง", evasion: "โอกาสหลบเป็น % รวมโบนัส SPD แล้วไม่เกิน 20%", armorPierce: "มองข้าม DEF ของคู่ต่อสู้ตามแต้มเป็น %"
  };
  const skills = {
    strike: { name: "โจมตีหนัก", description: "โจมตีแรง 1.6 เท่า" },
    poison: { name: "พิษ", description: "โจมตี 0.8 เท่า ติดพิษ 3 ตาของเป้าหมาย ตาละ 4% HP สูงสุด" },
    heal: { name: "ฟื้นพลัง", description: "ใช้ตานั้นฟื้น 18% HP สูงสุดแทนโจมตี" },
    shield: { name: "สร้างโล่", description: "ใช้ตานั้นสร้างโล่ 20% HP สูงสุดแทนโจมตี โล่สะสมสูงสุด 25%" }
  };
  const traits = {
    none: { name: "ไม่มีติดตัว", description: "ไม่มีผลเพิ่มเติม" },
    thorns: { name: "หนามสะท้อน", description: "สะท้อน 15% ของดาเมจที่เข้าเลือดจริง ไม่สะท้อนต่อกัน" },
    regeneration: { name: "ฟื้นตัว", description: "ฟื้น 3% HP สูงสุดต้นตาตัวเอง หลังรับพิษและเมื่อยังไม่ตาย" },
    berserk: { name: "ฮึดสู้", description: "โจมตีแรงขึ้น 20% เมื่อ HP เหลือไม่เกิน 35%" }
  };

  // สร้างสำเนาสำหรับใช้งาน ไม่เขียนทับข้อมูลต้นฉบับของผู้เรียน
  function validate(monster, registry) {
    const errors = [];
    const warnings = [];
    const source = monster && monster.stats;
    const stats = {};
    let rawTotal = 0;
    let canTotal = true;
    if (!monster || typeof monster.id !== "string" || !monster.id.trim()) errors.push("ต้องมี ID");
    if (monster && (registry || []).filter(function (entry) { return entry && entry.id === monster.id; }).length > 1) errors.push("ID ซ้ำกับมอนสเตอร์ตัวอื่น");
    if (!monster || typeof monster.name !== "string" || !monster.name.trim()) errors.push("ต้องใส่ชื่อมอนสเตอร์");
    statKeys.forEach(function (key, index) {
      // ไฟล์รุ่นเก่าที่มีแค่ 4 stats ยังใช้ได้ โดยค่าใหม่เริ่มที่ 0
      const value = source && source[key] !== undefined ? source[key] : (index >= 4 ? 0 : undefined);
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(labels[key] + " ต้องเป็นตัวเลขที่มีค่าจำกัด");
        canTotal = false;
        stats[key] = 0;
        return;
      }
      rawTotal += value;
      stats[key] = Math.max(0, Math.min(limits[key], Math.floor(value)));
      if (stats[key] !== value) warnings.push(labels[key] + ": " + value + " → " + stats[key] + " (เพดาน " + limits[key] + ")");
    });
    let total = statKeys.reduce(function (sum, key) { return sum + stats[key]; }, 0);
    if (total > budget) {
      // ลดตามสัดส่วน แล้วแจกเศษแต้มให้ครบ 100 โดยไม่มีค่าใดเพิ่มเกินเพดาน
      const shares = statKeys.map(function (key) { const scaled = stats[key] * budget / total; return { key: key, value: Math.floor(scaled), fraction: scaled - Math.floor(scaled) }; });
      let remainder = budget - shares.reduce(function (sum, share) { return sum + share.value; }, 0);
      shares.slice().sort(function (a, b) { return b.fraction - a.fraction; }).forEach(function (share) { if (remainder > 0) { share.value += 1; remainder -= 1; } });
      shares.forEach(function (share) { stats[share.key] = share.value; });
      warnings.push("รวมหลังจำกัดรายค่า " + total + " แต้ม เกินงบ 100 จึงลดทุกค่าตามสัดส่วนเหลือ 100 แต้ม");
      total = budget;
    }
    const skill = monster && monster.skill === undefined ? "strike" : monster && monster.skill;
    const trait = monster && monster.trait === undefined ? "none" : monster && monster.trait;
    if (typeof skill !== "string" || !Object.prototype.hasOwnProperty.call(skills, skill)) errors.push("สกิลไม่ถูกต้อง: ใช้ strike, poison, heal หรือ shield");
    if (typeof trait !== "string" || !Object.prototype.hasOwnProperty.call(traits, trait)) errors.push("ติดตัวไม่ถูกต้อง: ใช้ none, thorns, regeneration หรือ berserk");
    return { valid: errors.length === 0, total: total, rawTotal: canTotal ? rawTotal : null, errors: errors, warnings: warnings, monster: Object.assign({}, monster, { stats: stats, skill: skill, trait: trait }) };
  }

  function visible(registry) { return registry.filter(function (monster) { return !monster || monster.enabled !== false; }); }
  return { validate: validate, visible: visible, statKeys: statKeys, labels: labels, limits: limits, budget: budget, descriptions: descriptions, skills: skills, traits: traits };
}());
