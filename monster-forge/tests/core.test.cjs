const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load() {
  const context = vm.createContext({ window: {} });
  ['js/data.js', 'monsters/monster-a.js', 'monsters/monster-b.js', 'monsters/boss.js', 'js/battle.js'].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context));
  return context.window;
}
function monster(id, stats) { return { id, name: id, stats }; }

test('starter data is valid, template is not registered, boss is hidden until enabled', () => {
  const w = load();
  assert.equal(w.MONSTERS.length, 3);
  w.MONSTERS.forEach(m => assert.equal(w.ForgeData.validate(m, w.MONSTERS).valid, true));
  assert.equal(w.ForgeData.visible(w.MONSTERS).length, 2);
  const boss = w.MONSTERS[2];
  assert.throws(() => w.ForgeBattle.simulate(w.MONSTERS[0], boss));
  boss.enabled = true;
  assert.equal(w.ForgeData.visible(w.MONSTERS).length, 3);
  assert.ok(w.ForgeBattle.simulate(w.MONSTERS[0], boss).events.length);
});

test('rejects non-numeric and non-finite stats without changing source data', () => {
  const w = load();
  for (const value of [NaN, Infinity, -Infinity, undefined, null, '25', {}, []]) {
    const m = monster('bad', { hp: value, attack: 25, defense: 25, speed: 25 });
    const result = w.ForgeData.validate(m, [m]);
    assert.equal(result.valid, false, String(value));
    assert.equal(m.stats.hp, value);
    assert.match(result.errors.join(' '), /HP/);
  }
  assert.equal(w.ForgeData.validate(null, [null]).valid, false);
  assert.equal(w.ForgeData.validate({ id: 'empty', name: 'empty' }, []).valid, false);
});

test('duplicate IDs, blank names and self battles are rejected', () => {
  const w = load();
  const a = w.MONSTERS[0];
  assert.throws(() => w.ForgeBattle.simulate(a, a));
  assert.equal(w.ForgeData.validate({ ...a, name: ' ' }, []).valid, false);
  assert.equal(w.ForgeData.validate(a, [a, { ...a }]).valid, false);
});

test('faster monster goes first, ties randomize, dodges are logged', () => {
  const w = load();
  const [a, b] = w.MONSTERS;
  assert.equal(w.ForgeBattle.simulate(a, b, () => .5).events[0].attacker, 1);
  const c = monster('c', { ...a.stats });
  assert.equal(w.ForgeBattle.simulate(a, c, () => .1).events[0].attacker, 0);
  assert.equal(w.ForgeBattle.simulate(a, c, () => .9).events[0].attacker, 1);
  const draw = w.ForgeBattle.simulate({ ...a, skill: 'strike', trait: 'none' }, { ...b, skill: 'strike', trait: 'none' }, () => 0);
  assert.equal(draw.turns, 100);
  assert.equal(draw.winner, null);
  assert.ok(draw.events.every(e => e.dodged && e.damage === 0));
});

test('damage responds to ATK/DEF and health responds to HP', () => {
  const w = load();
  const base = monster('base', { hp: 25, attack: 25, defense: 25, speed: 25 });
  const highAttack = monster('high', { hp: 0, attack: 50, defense: 25, speed: 25 });
  const target = monster('target', { hp: 40, attack: 20, defense: 20, speed: 20 });
  const armored = monster('armor', { hp: 20, attack: 20, defense: 40, speed: 20 });
  const hit = (a, b) => w.ForgeBattle.simulate(a, b, () => .5).events[0].damage;
  assert.ok(hit(highAttack, target) > hit(base, target));
  assert.ok(hit(base, armored) < hit(base, target));
  assert.ok(w.ForgeBattle.maxHP(target) > w.ForgeBattle.maxHP(armored));
});

test('extreme and generated 100-point builds finish safely without mutation', () => {
  const w = load();
  let seed = 12345;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const builds = [
    { hp: 100, attack: 0, defense: 0, speed: 0 },
    { hp: 0, attack: 100, defense: 0, speed: 0 },
    { hp: 0, attack: 0, defense: 100, speed: 0 },
    { hp: 0, attack: 0, defense: 0, speed: 100 }
  ];
  for (let i = 0; i < 100; i++) {
    const cuts = [0, 100, Math.floor(rng() * 101), Math.floor(rng() * 101), Math.floor(rng() * 101)].sort((a, b) => a - b);
    builds.push({ hp: cuts[1], attack: cuts[2] - cuts[1], defense: cuts[3] - cuts[2], speed: 100 - cuts[3] });
  }
  for (let i = 0; i < builds.length; i++) {
    for (let j = 0; j < builds.length; j++) {
      const a = monster('a', builds[i]);
      const b = monster('b', builds[j]);
      const before = JSON.stringify([a, b]);
      const result = w.ForgeBattle.simulate(a, b, rng);
      assert.ok(result.turns > 0 && result.turns <= 100);
      assert.equal(JSON.stringify([a, b]), before);
      let previous = result.maxHP;
      result.events.forEach((e, turn) => {
        assert.equal(e.turn, turn + 1);
        assert.ok(e.hp.every((hp, n) => hp >= 0 && hp <= previous[n]));
        assert.equal(previous[e.defender] - e.hp[e.defender], e.damage);
        if (turn) assert.notEqual(e.attacker, result.events[turn - 1].attacker);
        previous = e.hp;
      });
      if (result.winner !== null) {
        assert.equal(result.hp[1 - result.winner], 0);
        assert.ok(result.hp[result.winner] > 0);
      } else assert.equal(result.turns, 100);
    }
  }
});

test('all HTML script/image references resolve locally, template stays unloaded', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.ok(!scripts.includes('monsters/monster-template.js'));
  assert.equal(scripts[0], 'js/data.js');
  scripts.forEach(file => { assert.ok(fs.existsSync(path.join(root, file))); new vm.Script(fs.readFileSync(path.join(root, file), 'utf8')); });
  const w = load();
  w.MONSTERS.forEach(m => assert.ok(fs.existsSync(path.join(root, m.image))));
  assert.ok(fs.existsSync(path.join(root, 'assets/placeholder.svg')));
  assert.ok(!html.includes('http://') && !html.includes('https://'));
});

test('caps every stat and shared budget, reports adjustments, never mutates source', () => {
  const w = load();
  const m = monster('overpowered', Object.fromEntries(w.ForgeData.statKeys.map(key => [key, 999999])));
  const before = JSON.stringify(m);
  const checked = w.ForgeData.validate(m, [m]);
  assert.equal(checked.valid, true);
  assert.equal(checked.total, 100);
  assert.ok(checked.warnings.some(s => s.includes('ตามสัดส่วน')));
  for (const [key, value] of Object.entries(checked.monster.stats)) {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= w.ForgeData.limits[key]);
  }
  assert.equal(JSON.stringify(m), before);
  assert.deepEqual(w.ForgeData.validate(checked.monster, []).monster.stats, checked.monster.stats);
  const cappedBattle = w.ForgeBattle.simulate(m, w.MONSTERS[1], () => .5);
  const normalizedBattle = w.ForgeBattle.simulate(checked.monster, w.MONSTERS[1], () => .5);
  assert.deepEqual(cappedBattle, normalizedBattle);
  assert.equal(w.ForgeBattle.maxHP(m), 80 + checked.monster.stats.hp * 3);
  const strange = monster('strange', { hp: -30, attack: 1000, defense: 15.9, speed: 0 });
  const result = w.ForgeData.validate(strange, []);
  assert.equal(result.valid, true);
  assert.equal(result.monster.stats.hp, 0);
  assert.equal(result.monster.stats.attack, 40);
  assert.equal(result.monster.stats.defense, 15);
  assert.equal(result.total, 55);
});

test('legacy four-stat files work; invalid ability names and unsafe numbers cannot battle', () => {
  const w = load();
  const legacy = monster('legacy', { hp: 25, attack: 25, defense: 25, speed: 25 });
  const check = w.ForgeData.validate(legacy, []);
  assert.equal(check.valid, true);
  assert.equal(check.monster.skill, 'strike');
  assert.equal(check.monster.trait, 'none');
  assert.equal(check.monster.stats.critical, 0);
  for (const bad of [{ skill: 'nuke' }, { trait: 'immortal' }, { skill: ['strike'] }, { skill: 'constructor' }, { trait: '__proto__' }]) {
    assert.throws(() => w.ForgeBattle.simulate({ ...legacy, ...bad }, w.MONSTERS[0]));
  }
  assert.throws(() => w.ForgeBattle.simulate({ ...legacy, stats: { ...legacy.stats, critical: Infinity } }, w.MONSTERS[0]));
});

test('all skills activate on every third own action with fixed powers', () => {
  const w = load();
  for (const skill of Object.keys(w.ForgeData.skills)) {
    const a = { ...monster('a', { hp: 50, attack: 10, defense: 20, speed: 20 }), skill };
    const b = { ...monster('b', { hp: 50, attack: 10, defense: 20, speed: 20 }), skill: 'heal' };
    const result = w.ForgeBattle.simulate(a, b, () => .5);
    const own = result.events.filter(e => e.attacker === 0);
    assert.ok(own.length >= 3);
    own.forEach((e, i) => assert.equal(e.skill, (i + 1) % 3 === 0 ? skill : null));
    if (skill === 'strike') assert.ok(own[2].damage > own[1].damage);
    if (skill === 'heal') { assert.equal(own[2].damage, 0); assert.ok(own[2].healed > 0); }
    if (skill === 'shield') { assert.equal(own[2].damage, 0); assert.ok(own[2].shields[0] > 0); assert.ok(result.events.some(e => e.absorbed > 0)); }
    if (skill === 'poison') { assert.equal(own[2].poison[1], 3); assert.ok(result.events.some(e => e.poisonDamage > 0)); }
  }
});

test('poison lasts three victim turns and shield cannot exceed 25 percent of max HP', () => {
  const w = load();
  const a = { ...monster('a', { hp: 50, attack: 5, defense: 25, speed: 20 }), skill: 'poison' };
  const b = { ...monster('b', { hp: 50, attack: 0, defense: 40, speed: 0 }), skill: 'shield' };
  const result = w.ForgeBattle.simulate(a, b, () => .5);
  const poisoned = result.events.filter(e => e.attacker === 1 && e.poisonDamage > 0).slice(0, 3);
  assert.equal(poisoned.length, 3);
  assert.deepEqual(Array.from(poisoned, e => e.poison[1]), [2, 1, 0]);
  result.events.forEach(e => e.shields.forEach((shield, i) => assert.ok(shield >= 0 && shield <= Math.floor(result.maxHP[i] * .25))));
});

test('critical hits and armor piercing affect damage; lifesteal only heals real HP damage', () => {
  const w = load();
  const target = monster('target', { hp: 50, attack: 10, defense: 40, speed: 0 });
  const base = monster('base', { hp: 40, attack: 20, defense: 10, speed: 0 });
  const piercing = { ...base, stats: { ...base.stats, armorPierce: 30 } };
  const firstHit = m => w.ForgeBattle.simulate(m, target, () => .5).events.find(e => e.attacker === 0).damage;
  assert.ok(firstHit(piercing) > firstHit(base));
  const crit = { ...base, stats: { ...base.stats, critical: 20 } };
  const result = w.ForgeBattle.simulate(crit, target, () => .1);
  assert.ok(result.events.find(e => e.attacker === 0).critical);
  const vampire = monster('vampire', { hp: 35, attack: 30, defense: 0, speed: 15, lifesteal: 20 });
  const fight = w.ForgeBattle.simulate(vampire, target, () => .5);
  assert.equal(fight.events[0].healed, 0); // full HP on first attack
  assert.ok(fight.events.some(e => e.attacker === 0 && e.healed > 0));
  fight.events.filter(e => e.attacker === 0).forEach(e => assert.ok(e.healed <= Math.floor(e.damage * .2)));
});

test('traits regenerate, reflect once, and increase damage at low health', () => {
  const w = load();
  const stats = { hp: 50, attack: 20, defense: 20, speed: 10 };
  const enemy = monster('enemy', stats);
  const base = monster('base', stats);
  const plain = w.ForgeBattle.simulate(base, enemy, () => .5);
  const regen = w.ForgeBattle.simulate({ ...base, trait: 'regeneration' }, enemy, () => .5);
  assert.ok(regen.events.some(e => e.attacker === 0 && e.healed > 0));
  const thorny = w.ForgeBattle.simulate({ ...base, trait: 'thorns' }, { ...enemy, trait: 'thorns' }, () => .5);
  thorny.events.forEach(e => assert.ok(e.reflected <= Math.floor(e.damage * .15)));
  assert.ok(thorny.events.some(e => e.reflected > 0));
  const berserk = w.ForgeBattle.simulate({ ...base, trait: 'berserk' }, enemy, () => .5);
  assert.ok(berserk.events.some((e, i) => e.attacker === 0 && plain.events[i] && e.damage > plain.events[i].damage));
});

test('ability combinations stay within HP/shield/turn limits and rematches start fresh', () => {
  const w = load();
  const setups = Object.keys(w.ForgeData.skills).flatMap(skill => Object.keys(w.ForgeData.traits).map(trait => ({ skill, trait })));
  for (const left of setups) for (const right of setups) {
    const a = { ...monster('a', { hp: 25, attack: 20, defense: 15, speed: 10, critical: 10, lifesteal: 10, evasion: 5, armorPierce: 5 }), ...left };
    const b = { ...monster('b', { hp: 30, attack: 10, defense: 10, speed: 15, critical: 5, lifesteal: 10, evasion: 10, armorPierce: 10 }), ...right };
    const before = JSON.stringify([a, b]);
    const fight = w.ForgeBattle.simulate(a, b, () => .5);
    assert.ok(fight.turns <= 100);
    fight.events.forEach(e => e.hp.forEach((hp, i) => assert.ok(hp >= 0 && hp <= fight.maxHP[i])));
    assert.equal(JSON.stringify([a, b]), before);
    assert.deepEqual(w.ForgeBattle.simulate(a, b, () => .5), fight);
    if (fight.winner !== null) { assert.equal(fight.hp[1 - fight.winner], 0); assert.ok(fight.hp[fight.winner] > 0); }
  }
});

test('dodge chance is capped at 20 percent even when speed adds more', () => {
  const w = load();
  const a = monster('a', { hp: 40, attack: 20, defense: 0, speed: 40 });
  const b = monster('b', { hp: 40, attack: 0, defense: 0, speed: 40, evasion: 20 });
  assert.equal(w.ForgeBattle.simulate(a, b, () => .199).events[0].dodged, true);
  assert.equal(w.ForgeBattle.simulate(a, b, () => .201).events[0].dodged, false);
});

test('a final thorns hit can cause a double knockout rather than naming a dead winner', () => {
  const w = load();
  const a = { ...monster('a', { hp: 0, attack: 20, defense: 0, speed: 10 }), trait: 'thorns' };
  const b = { ...monster('b', { hp: 0, attack: 29, defense: 0, speed: 0 }), trait: 'thorns' };
  const result = w.ForgeBattle.simulate(a, b, () => .5);
  assert.equal(result.reason, 'double-ko');
  assert.equal(result.winner, null);
  assert.deepEqual(Array.from(result.hp), [0, 0]);
});

test('lethal poison ends the turn before regeneration or healing can revive its victim', () => {
  const w = load();
  const a = { ...monster('a', { hp: 40, attack: 2, defense: 30, speed: 20 }), skill: 'poison' };
  const b = { ...monster('b', { hp: 0, attack: 10, defense: 40, speed: 0 }), skill: 'heal', trait: 'regeneration' };
  const result = w.ForgeBattle.simulate(a, b, () => .5);
  const last = result.events.at(-1);
  assert.equal(result.winner, 0);
  assert.equal(last.attacker, 1);
  assert.ok(last.poisonDamage > 0);
  assert.equal(last.healed, 0);
  assert.equal(last.damage, 0);
  assert.equal(last.skill, null);
  assert.equal(last.hp[1], 0);
});
