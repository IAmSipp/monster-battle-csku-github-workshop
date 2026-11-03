"use strict";
window.ForgeBattle = (function () {
  const MAX_TURNS = 100;
  const data = window.ForgeData;
  function prepare(monster) {
    const check = data.validate(monster, window.MONSTERS);
    if (!check.valid || monster.enabled === false) throw new Error("มอนสเตอร์ยังไม่พร้อมต่อสู้: " + (monster && monster.name || "ไม่ระบุชื่อ"));
    return check.monster;
  }
  function healthFor(monster) { return 80 + monster.stats.hp * 3; }
  function maxHP(monster) { return healthFor(prepare(monster)); }

  function simulate(a, b, random) {
    if (!a || !b || a.id === b.id) throw new Error("กรุณาเลือกมอนสเตอร์คนละตัว");
    // cap อีกครั้งที่ระบบต่อสู้ ป้องกันการเรียก engine ด้วย stats เกิน
    const monsters = [prepare(a), prepare(b)];
    const maximum = monsters.map(healthFor);
    const health = maximum.slice();
    const shields = [0, 0];
    const poison = [0, 0];
    const actions = [0, 0];
    const rng = random || Math.random;
    const events = [];
    let attacker = monsters[0].stats.speed === monsters[1].stats.speed ? (rng() < 0.5 ? 0 : 1) : (monsters[0].stats.speed > monsters[1].stats.speed ? 0 : 1);
    let winner = null;
    let reason = "turn-limit";

    function heal(index, amount) { const restored = Math.min(maximum[index] - health[index], amount); health[index] += restored; return restored; }
    for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
      const defender = 1 - attacker;
      const actor = monsters[attacker];
      const target = monsters[defender];
      const messages = [];
      const event = { turn: turn, attacker: attacker, defender: defender, damage: 0, dodged: false, critical: false, skill: null, reflected: 0, healed: 0, poisonDamage: 0, absorbed: 0, messages: messages };

      // พิษนับตามตาของผู้ติดพิษ ไม่ซ้อนจำนวนชั้น และฆ่าได้ก่อนลงมือ
      if (poison[attacker] > 0) {
        event.poisonDamage = Math.min(health[attacker], Math.max(1, Math.round(maximum[attacker] * 0.04)));
        health[attacker] -= event.poisonDamage;
        poison[attacker] -= 1;
        messages.push(actor.name + " เสีย HP จากพิษ " + event.poisonDamage);
      }
      if (health[attacker] > 0) {
        if (actor.trait === "regeneration") {
          const restored = heal(attacker, Math.round(maximum[attacker] * 0.03));
          event.healed += restored;
          if (restored) messages.push(actor.name + " ฟื้นตัว " + restored + " HP");
        }
        actions[attacker] += 1;
        // สกิลอัตโนมัติทุกตาที่ 3 ของตัวเอง ค่าพลังและ cooldown กำหนดจาก engine
        event.skill = actions[attacker] % 3 === 0 ? actor.skill : null;
        if (event.skill === "heal") {
          const restored = heal(attacker, Math.round(maximum[attacker] * 0.18));
          event.healed += restored;
          messages.push(actor.name + " ใช้ฟื้นพลัง +" + restored + " HP");
        } else if (event.skill === "shield") {
          const gained = Math.min(Math.floor(maximum[attacker] * 0.25) - shields[attacker], Math.round(maximum[attacker] * 0.2));
          shields[attacker] += gained;
          messages.push(actor.name + " สร้างโล่ +" + gained + " (เหลือ " + shields[attacker] + ")");
        } else {
          const dodgeChance = Math.min(0.2, (target.stats.evasion + target.stats.speed * 0.1) / 100);
          event.dodged = rng() < dodgeChance;
          if (event.dodged) messages.push(target.name + " หลบการโจมตีของ " + actor.name + " ได้");
          else {
            event.critical = rng() < actor.stats.critical / 100;
            const effectiveDefense = target.stats.defense * (1 - actor.stats.armorPierce / 100);
            const skillPower = event.skill === "strike" ? 1.6 : (event.skill === "poison" ? 0.8 : 1);
            const berserkPower = actor.trait === "berserk" && health[attacker] <= maximum[attacker] * 0.35 ? 1.2 : 1;
            const damage = Math.max(1, Math.round((12 + actor.stats.attack * 0.8) * 50 / (50 + effectiveDefense) * (0.9 + rng() * 0.2) * skillPower * berserkPower * (event.critical ? 1.5 : 1)));
            event.absorbed = Math.min(shields[defender], damage);
            shields[defender] -= event.absorbed;
            event.damage = Math.min(health[defender], damage - event.absorbed);
            health[defender] -= event.damage;
            messages.push(actor.name + (event.skill ? " ใช้" + data.skills[event.skill].name : " โจมตี") + (event.critical ? " คริติคอล!" : "") + " → " + target.name + " เสีย HP " + event.damage + (event.absorbed ? " (โล่รับ " + event.absorbed + ")" : ""));
            // ดูดเลือด/สะท้อนคิดจากเลือดที่เสียจริง ไม่รวมโล่หรือดาเมจส่วนเกิน
            const restored = heal(attacker, Math.floor(event.damage * actor.stats.lifesteal / 100));
            event.healed += restored;
            if (restored) messages.push(actor.name + " ดูดเลือด +" + restored + " HP");
            if (event.skill === "poison" && health[defender] > 0) { poison[defender] = 3; messages.push(target.name + " ติดพิษ 3 ตา"); }
            if (target.trait === "thorns" && event.damage > 0) {
              event.reflected = Math.min(health[attacker], Math.floor(event.damage * 0.15));
              health[attacker] -= event.reflected;
              if (event.reflected) messages.push(actor.name + " โดนหนามสะท้อน " + event.reflected);
            }
          }
        }
      }
      event.hp = health.slice(); event.shields = shields.slice(); event.poison = poison.slice();
      events.push(event);
      if (health[0] === 0 || health[1] === 0) {
        winner = health[0] === 0 && health[1] === 0 ? null : (health[0] > 0 ? 0 : 1);
        reason = winner === null ? "double-ko" : "knockout";
        break;
      }
      attacker = defender;
    }
    return { events: events, winner: winner, reason: reason, hp: health.slice(), maxHP: maximum, turns: events.length };
  }
  return { simulate: simulate, maxHP: maxHP, MAX_TURNS: MAX_TURNS };
}());
