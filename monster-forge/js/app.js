"use strict";
(function () {
  const data = window.ForgeData;
  const battle = window.ForgeBattle;
  const registry = window.MONSTERS;
  const monsters = data.visible(registry);
  const validMonsters = monsters.map(function (monster) { return data.validate(monster, registry); }).filter(function (check) { return check.valid; }).map(function (check) { return check.monster; });
  const $ = function (id) { return document.getElementById(id); };
  const selectA = $("select-a");
  const selectB = $("select-b");
  const fighters = [$("fighter-a"), $("fighter-b")];
  let timer = null;
  let running = false;
  let simulation = null;
  let pair = [];
  let eventIndex = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setImage(img, monster) {
    img.onerror = function () { img.onerror = null; img.src = "assets/placeholder.svg"; };
    // เฉพาะรูปในโฟลเดอร์ assets เพื่อให้เว็บใช้งานออฟไลน์เสมอ
    const path = monster && monster.image;
    img.src = typeof path === "string" && /^assets\/[\w\-./\u0E00-\u0E7F ]+\.(svg|png|jpe?g|webp)$/i.test(path) && !path.includes("..") ? path : "assets/placeholder.svg";
    img.alt = monster ? "รูป " + monster.name : "ยังไม่ได้เลือกมอนสเตอร์";
  }

  function renderGallery() {
    $("monster-count").textContent = monsters.length + " ตัว";
    if (!monsters.length) $("gallery").append(element("p", "muted", "ยังไม่มีมอนสเตอร์ที่เปิดใช้งาน"));
    monsters.forEach(function (monster) {
      const check = data.validate(monster, registry);
      const card = element("article", "monster-card");
      const portrait = element("div", "portrait");
      const img = element("img");
      img.width = 112; img.height = 112;
      setImage(img, monster);
      portrait.append(img);
      card.append(portrait, element("h3", "", monster && monster.name || "มอนสเตอร์ไม่มีชื่อ"), element("p", "description", monster && monster.description || "ยังไม่มีคำอธิบาย"));
      const stats = element("dl", "stats");
      data.statKeys.forEach(function (key) {
        const row = element("div", "stat");
        const value = check.monster.stats[key];
        row.title = data.descriptions[key];
        row.append(element("dt", "", data.labels[key]), element("dd", "", value + "/" + data.limits[key]));
        stats.append(row);
      });
      const bottom = element("div", "card-bottom");
      bottom.append(element("span", "", check.total + "/100 แต้ม"), element("span", check.valid ? "valid" : "error", check.valid ? "พร้อมต่อสู้" : "ต้องแก้ไขข้อมูล"));
      card.append(stats, bottom);
      if (check.valid) {
        const loadout = element("div", "loadout");
        const skill = data.skills[check.monster.skill];
        const trait = data.traits[check.monster.trait];
        loadout.append(element("p", "", "สกิล: " + skill.name + " · ทุก 3 ตาตัวเอง"), element("p", "muted", skill.description), element("p", "", "ติดตัว: " + trait.name), element("p", "muted", trait.description));
        card.append(loadout);
      }
      if (check.warnings.length) card.append(element("p", "cap-notice", "จำกัดค่าแล้ว: " + check.warnings.join(" · ")));
      if (check.valid && check.total < data.budget) card.append(element("p", "muted", "เหลือให้แบ่งอีก " + (data.budget - check.total) + " แต้ม"));
      if (!check.valid) card.append(element("p", "error", (monster && monster.name || "มอนสเตอร์ไม่มีชื่อ") + ": " + check.errors.join(" · ")));
      $("gallery").append(card);
    });
  }

  function getPair() {
    return [selectA, selectB].map(function (select) { return validMonsters.find(function (monster) { return monster.id === select.value; }); });
  }

  function updateFighter(index, monster, hp, shield, poison) {
    const panel = fighters[index];
    setImage(panel.querySelector("img"), monster);
    panel.querySelector("h3").textContent = monster ? monster.name : "ยังไม่มีมอนสเตอร์";
    const maximum = monster ? battle.maxHP(monster) : 1;
    const current = monster ? (hp === undefined ? maximum : hp) : 0;
    panel.querySelector(".hp-value").textContent = monster ? "HP " + current + " / " + maximum : "HP —";
    const bar = panel.querySelector("progress");
    bar.max = maximum; bar.value = current;
    bar.setAttribute("aria-label", "HP " + (monster ? monster.name : "มอนสเตอร์"));
    let effects = panel.querySelector(".fighter-effects");
    if (!effects) { effects = element("p", "fighter-effects"); panel.append(effects); }
    effects.textContent = monster ? data.skills[monster.skill].name + " · " + data.traits[monster.trait].name + (shield ? " · โล่ " + shield : "") + (poison ? " · พิษ " + poison + " ตา" : "") : "";
  }

  function selectionMessage() {
    const selected = getPair();
    if (validMonsters.length < 2) return "ต้องมีมอนสเตอร์ที่ข้อมูลถูกต้องอย่างน้อย 2 ตัว";
    if (!selected[0] || !selected[1]) return "กรุณาเลือกมอนสเตอร์ทั้งสองฝั่ง";
    if (selected[0].id === selected[1].id) return "เลือกมอนสเตอร์คนละตัวเพื่อเริ่มต่อสู้";
    return "";
  }

  function updateControls() {
    const message = selectionMessage();
    $("selection-error").textContent = message;
    $("selection-error").hidden = !message;
    $("start").disabled = running || !!message;
    $("start").hidden = !!simulation;
    $("rematch").hidden = !simulation || running;
    $("rematch").disabled = !!message;
    $("skip").hidden = !running;
    selectA.disabled = running || !validMonsters.length;
    selectB.disabled = running || !validMonsters.length;
  }

  function resetArena() {
    clearInterval(timer);
    timer = null; running = false; simulation = null; eventIndex = 0;
    pair = getPair();
    pair.forEach(function (monster, index) { updateFighter(index, monster); });
    $("result").textContent = "เลือกมอนสเตอร์สองตัวเพื่อเริ่มต่อสู้";
    $("result").classList.remove("finished");
    $("turn-count").textContent = "0 ตา";
    $("battle-log").replaceChildren(element("li", "empty-log", "การโจมตีแต่ละตาจะแสดงที่นี่"));
    updateControls();
  }

  function finish() {
    clearInterval(timer); timer = null; running = false;
    $("result").textContent = simulation.winner === null ? (simulation.reason === "double-ko" ? "เสมอ — HP หมดทั้งคู่" : "เสมอ — ครบ " + battle.MAX_TURNS + " ตา") : "ผู้ชนะ: " + pair[simulation.winner].name;
    $("result").classList.add("finished");
    updateControls();
  }

  function showNextTurn() {
    const event = simulation.events[eventIndex];
    if (!event) return;
    const message = event.messages.join(" · ");
    $("battle-log").append(element("li", "", "ตา " + event.turn + " · " + message));
    event.hp.forEach(function (hp, index) { updateFighter(index, pair[index], hp, event.shields[index], event.poison[index]); });
    $("turn-count").textContent = event.turn + " ตา";
    $("battle-log").scrollTop = $("battle-log").scrollHeight;
    eventIndex += 1;
    if (eventIndex === simulation.events.length) finish();
  }

  function startBattle() {
    if (running || selectionMessage()) return;
    pair = getPair();
    try { simulation = battle.simulate(pair[0], pair[1]); }
    catch (error) { $("selection-error").textContent = error.message; $("selection-error").hidden = false; return; }
    eventIndex = 0; running = true;
    pair.forEach(function (monster, index) { updateFighter(index, monster); });
    $("battle-log").replaceChildren();
    $("result").textContent = "กำลังต่อสู้…";
    $("result").classList.remove("finished");
    updateControls();
    showNextTurn();
    if (running) timer = setInterval(showNextTurn, 300);
  }

  const rules = $("ability-rules");
  if (rules) {
    rules.append(element("p", "", "แบ่งได้รวมสูงสุด 100 แต้ม ใส่ไม่ครบยังต่อสู้ได้ ค่าติดลบลดเป็น 0 ทศนิยมปัดลง ค่าเกินจะถูก cap รายค่า แล้วลดตามสัดส่วนถ้ายังเกินงบ โดยไม่แก้ไฟล์ต้นฉบับ"));
    data.statKeys.forEach(function (key) { rules.append(element("p", "", data.labels[key] + " ≤ " + data.limits[key] + " · " + data.descriptions[key])); });
    rules.append(element("h3", "", "เลือก skill 1 อย่าง · ใช้อัตโนมัติทุก 3 ตาตัวเอง"));
    Object.keys(data.skills).forEach(function (key) { rules.append(element("p", "", key + " — " + data.skills[key].name + ": " + data.skills[key].description)); });
    rules.append(element("h3", "", "เลือก trait 1 อย่าง"));
    Object.keys(data.traits).forEach(function (key) { rules.append(element("p", "", key + " — " + data.traits[key].name + ": " + data.traits[key].description)); });
  }
  renderGallery();
  [selectA, selectB].forEach(function (select) {
    if (!validMonsters.length) select.append(element("option", "", "ยังไม่มีตัวที่พร้อมต่อสู้"));
    validMonsters.forEach(function (monster) { const option = element("option", "", monster.name); option.value = monster.id; select.append(option); });
    select.addEventListener("change", resetArena);
  });
  if (validMonsters.length > 1) selectB.value = validMonsters[1].id;
  $("start").addEventListener("click", startBattle);
  $("rematch").addEventListener("click", startBattle);
  $("reset").addEventListener("click", resetArena);
  $("skip").addEventListener("click", function () { clearInterval(timer); while (running) showNextTurn(); });
  resetArena();
}());
