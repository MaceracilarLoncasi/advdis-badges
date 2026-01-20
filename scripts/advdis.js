const MODULE_ID = "advdis-badges";

// --- i18n (0.1.0) ---
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "language", {
    name: game.i18n.localize("ADVDIS.Setting.Language.Name"),
    hint: game.i18n.localize("ADVDIS.Setting.Language.Hint"),
    scope: "client",
    config: true,
    type: String,
    choices: {
      "en": game.i18n.localize("ADVDIS.Setting.Language.English"),
      "tr": game.i18n.localize("ADVDIS.Setting.Language.Turkish"),
      "auto": game.i18n.localize("ADVDIS.Setting.Language.Auto")
    },
    default: "en"
  });
});

function advdisT(key){
  const pref = game.settings.get(MODULE_ID, "language");
  if (pref === "auto") return game.i18n.localize(key);
  // Temporarily override localization lookup by selecting dictionary directly
  const dict = (pref === "tr") ? game.i18n.translations?.tr : game.i18n.translations?.en;
  const val = foundry.utils.getProperty(dict ?? {}, key) ?? null;
  if (typeof val === "string") return val;
  // Fallback to Foundry language
  const fb = game.i18n.localize(key);
  return fb === key ? key : fb;
}

// --- Effects inference (v0.6.6.2) ---
function _norm(s){ return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function collectFromItemEffects(item){
  try{
    const effects = item?.effects?.contents ?? item?.effects ?? [];
    if (!effects || !effects.length) return null;

    const skillKeys = Object.keys(CONFIG?.DND5E?.skills ?? {});
    const abilityKeys = Object.keys(CONFIG?.DND5E?.abilities ?? {});

    let mode = ""; // adv|dis
    const skills = new Set();
    const saves = new Set();
    let note = "";

    for (const ef of effects){
      const efName = ef?.name ?? "";
      for (const ch of (ef?.changes ?? [])){
        const rawKey = String(ch?.key ?? "");
        const rawVal = String(ch?.value ?? "").trim();
        const key = _norm(rawKey);
        const blob = `${key} ${_norm(rawVal)} ${_norm(efName)}`;

        // Numeric roll.mode conventions (most reliable)
        const isRollMode = key.endsWith('.roll.mode');
        const isAdvNum = isRollMode && rawVal === '1';
        const isDisNum = isRollMode && rawVal === '-1';

        // Text fallback
        const isAdvTxt = blob.includes('advantage') || blob.includes(' avantaj');
        const isDisTxt = blob.includes('disadvantage') || blob.includes(' dezavant');

        const isAdv = isAdvNum || isAdvTxt;
        const isDis = isDisNum || isDisTxt;
        if (!isAdv && !isDis) continue;

        if (!mode) mode = isDis ? 'dis' : 'adv';

        // Key patterns
        const mSkill = rawKey.match(/system\.skills\.([a-z]{3})\./i);
        if (mSkill){
          const sk = mSkill[1].toLowerCase();
          if (skillKeys.includes(sk)) skills.add(sk);
        }
        const mSave = rawKey.match(/system\.abilities\.([a-z]{3})\.(?:save|saves)\.roll\.mode/i);
        if (mSave){
          const ab = mSave[1].toLowerCase();
          if (abilityKeys.includes(ab)) saves.add(ab);
        }

        if (!note) note = item?.name || '';
      }
    }

    if (!mode) return null;
    if (!skills.size && !saves.size) return null;
    return { mode, skills: Array.from(skills), saves: Array.from(saves), note: (item?.name || '') };
  } catch(_e){
    return null;
  }
}


/* flags */
function getFlags(item){
  return {
    mode: item.getFlag(MODULE_ID,"mode") ?? "",
    note: item.getFlag(MODULE_ID,"note") ?? "",
    skills: Array.isArray(item.getFlag(MODULE_ID,"skills")) ? item.getFlag(MODULE_ID,"skills") : [],
    saves: Array.isArray(item.getFlag(MODULE_ID,"saves")) ? item.getFlag(MODULE_ID,"saves") : []
  };
}
function setFlags(item, {mode, note, skills, saves}){
  return Promise.all([
    item.setFlag(MODULE_ID,"mode", mode ?? ""),
    item.setFlag(MODULE_ID,"note", note ?? ""),
    item.setFlag(MODULE_ID,"skills", Array.isArray(skills) ? skills : []),
    item.setFlag(MODULE_ID,"saves", Array.isArray(saves) ? saves : [])
  ]);
}
function uniqueSorted(arr){ return Array.from(new Set(arr)).sort((a,b)=>a.localeCompare(b)); }
function labelSkill(key){ const s=CONFIG?.DND5E?.skills?.[key]; return (typeof s==="string")?s:(s?.label??key); }
function labelAbility(key){ const a=CONFIG?.DND5E?.abilities?.[key]; return (typeof a==="string")?a:(a?.label??key); }

/* item UI helpers */
function toJQ(app, html){
  if (app?.element) return $(app.element);
  if (html?.jquery) return html;
  if (html instanceof HTMLElement) return $(html);
  return null;
}
function isItemSheet(app){
  const obj = app?.object ?? app?.document;
  if (obj?.documentName === "Item") return true;
  return ((app?.constructor?.name ?? "").toLowerCase().includes("itemsheet"));
}
function renderChips($container, keys, labelFn, onRemove){
  $container.empty();
  for (const k of keys){
    const chip = $(`
      <span class="advdis-chip" data-key="${k}">
        <span>${labelFn(k)}</span>
        <button type="button" aria-label="Kaldır" title="Kaldır">×</button>
      </span>
    `);
    chip.find("button").on("click", () => onRemove(k));
    $container.append(chip);
  }
}
function buildItemSection(item){
  const f = getFlags(item);
  const skillKeys = Object.keys(CONFIG?.DND5E?.skills ?? {}).sort();
  const saveKeys  = Object.keys(CONFIG?.DND5E?.abilities ?? {}).sort();

  const section = $(`
    <section class="advdis-section">
      <h3>${advdisT('ADVDIS.SectionTitle')}</h3>

      <div class="form-group">
        <label>${advdisT('ADVDIS.Mode')}</label>
        <select name="advdis-mode">
          <option value="">${advdisT("ADVDIS.None")}</option>
          <option value="adv">${advdisT("ADVDIS.Adv")}</option>
          <option value="dis">${advdisT("ADVDIS.Dis")}</option>
        </select>
      </div>

      <div class="form-group">
        <label>${advdisT('ADVDIS.Note')}</label>
        <input type="text" name="advdis-note" placeholder="${advdisT('ADVDIS.NotePH')}"/>
      </div>

      <div class="form-group">
        <label>${advdisT('ADVDIS.Skill')}</label>
        <select name="advdis-skill-add">
          <option value="">${advdisT("ADVDIS.Select")}</option>
          ${skillKeys.map(k => `<option value="${k}">${labelSkill(k)}</option>`).join("")}
        </select>
      </div>
      <div class="advdis-selected advdis-selected-skills"></div>

      <div class="form-group">
        <label>${advdisT('ADVDIS.Save')}</label>
        <select name="advdis-save-add">
          <option value="">${advdisT("ADVDIS.Select")}</option>
          ${saveKeys.map(k => `<option value="${k}">${labelAbility(k)}</option>`).join("")}
        </select>
      </div>
      <div class="advdis-selected advdis-selected-saves"></div>

      <div class="advdis-hint">${advdisT('ADVDIS.Hint')}</div>
    </section>
  `);

  section.find('[name="advdis-mode"]').val(f.mode);
  section.find('[name="advdis-note"]').val(f.note);

  let state = { mode:f.mode, note:f.note, skills:uniqueSorted(f.skills), saves:uniqueSorted(f.saves) };
  const $skillChips = section.find(".advdis-selected-skills");
  const $saveChips  = section.find(".advdis-selected-saves");

  function sync(){
    renderChips($skillChips, state.skills, labelSkill, (k)=>{ state.skills = state.skills.filter(x=>x!==k); save(); });
    renderChips($saveChips,  state.saves,  labelAbility,(k)=>{ state.saves  = state.saves.filter(x=>x!==k); save(); });
  }

  let t=null;
  function save(){
    clearTimeout(t);
    t=setTimeout(()=>{
      state.mode = section.find('[name="advdis-mode"]').val() || "";
      state.note = section.find('[name="advdis-note"]').val() || "";
      setFlags(item, state);
      sync();
    },120);
  }

  section.on("change",'[name="advdis-mode"]',save);
  section.on("change",'[name="advdis-note"]',save);
  section.on("blur",'[name="advdis-note"]',save);
  section.on("keydown",'[name="advdis-note"]', (ev) => { if (ev.key === "Enter") { ev.preventDefault(); ev.currentTarget.blur(); } });
  section.on("change",'[name="advdis-skill-add"]',(e)=>{
    const v=e.currentTarget.value;
    if(!v) return;
    state.skills = uniqueSorted([...state.skills, v]);
    e.currentTarget.value="";
    save();
  });
  section.on("change",'[name="advdis-save-add"]',(e)=>{
    const v=e.currentTarget.value;
    if(!v) return;
    state.saves = uniqueSorted([...state.saves, v]);
    e.currentTarget.value="";
    save();
  });

  sync();
  return section;
}
function injectItemUI(app, htmlArg){
  if (game?.system?.id !== "dnd5e") return;
  if (!isItemSheet(app)) return;
  const item = app?.object ?? app?.document;
  if (!item || item.documentName !== "Item") return;

  const $root = toJQ(app, htmlArg);
  if (!$root || !$root.length) return;
  if ($root.find(".advdis-section").length) return;

  const detailsTab = $root.find('.tab[data-tab="details"]').first();
  const within = detailsTab.length ? detailsTab : $root;

  const equip = within.find(".equipment-details").first();
  const section = buildItemSection(item);
  if (equip.length) equip.after(section);
  else within.append(section);
}
Hooks.on("renderItemSheet5e", injectItemUI);
Hooks.on("renderItemSheet", injectItemUI);
Hooks.on("renderApplication", (app, html) => { if (isItemSheet(app)) injectItemUI(app, html); });

/* actor badges */
function makeBadge(mode,title){
  const el=document.createElement("span");
  el.classList.add("advdis-badge",mode);
  el.textContent = mode==="adv" ? "A" : "D";
  el.title=title;
  return el;
}
function closestRowFrom(el){
  if(!el) return null;
  const $el = $(el);
  const row = $el.closest("li,.row,.skill,.skill-row,.save,.save-row,.ability,.ability-row,.saving-throw,.tidy5e-save");
  return row?.length ? row.first() : $el;
}
function findSkillRow(html, key){
  const direct = html.find(`[data-skill="${key}"]`).first();
  if(direct?.length) return closestRowFrom(direct[0]);
  const inp = html.find(`[name="system.skills.${key}.value"]`).first();
  if(inp?.length) return closestRowFrom(inp[0]);
  return null;
}
function findSaveRow(html, key){
  const direct = html.find(`[data-ability="${key}"]`).first();
  if(direct?.length) return closestRowFrom(direct[0]);
  const prof = html.find(`[name="system.abilities.${key}.proficient"]`).first();
  if(prof?.length) return closestRowFrom(prof[0]);
  return null;
}
function findNameCell(row){
  const $row = row.jquery ? row : $(row);
  const cand = $row.find(".name,.skill-name,.ability-name,.label,.title").first();
  if(cand?.length) return cand;

  const nodes = $row.find("a,span,div").toArray();
  for(const n of nodes){
    const t = (n.textContent ?? "").trim();
    if(!t) continue;
    if(t.length <= 3 && /^[A-ZÇĞİÖŞÜ]{2,3}$/i.test(t)) continue;
    if(/^[+-]?\d+/.test(t)) continue;
    if(n.classList.contains("mod") || n.classList.contains("modifier") || n.classList.contains("value") || n.classList.contains("bonus")) continue;
    return $(n);
  }
  return null;
}
function placeBadgeBetweenNameAndMod(row, badge){
  if(!row?.length) return;

  const exists = Array.from(row[0].querySelectorAll(".advdis-badge"))
    .some(b => b.textContent===badge.textContent && b.title===badge.title);
  if(exists) return;

  const $row = $(row[0]);
  const $name = findNameCell($row);
  if($name && $name.length){
    $name.addClass("advdis-name-host");
    $name.append(badge);
    return;
  }
  $row.append(badge);
}
function injectActorBadges(app){
  if (game?.system?.id !== "dnd5e") return;
  const actor = app?.object ?? app?.document;
  if(!actor || actor.documentName !== "Actor") return;

  const html = app?.element ? $(app.element) : null;
  if(!html?.length) return;

  html.find(".advdis-badge").remove();
  html.find(".advdis-name-host").removeClass("advdis-name-host");

  for (const item of (actor.items?.contents ?? actor.items ?? [])){
    let f = getFlags(item);
    if(!f.mode){
      const inferred = collectFromItemEffects(item);
      if(inferred) f = inferred;
    }
    if(!f.mode || (f.mode !== "adv" && f.mode !== "dis")) continue;
    const title = f.note?.trim() || item.name;

    for(const sk of f.skills){
      const row = findSkillRow(html, sk);
      if(row?.length) placeBadgeBetweenNameAndMod(row, makeBadge(f.mode, title));
    }
    for(const ab of f.saves){
      const row = findSaveRow(html, ab);
      if(row?.length) placeBadgeBetweenNameAndMod(row, makeBadge(f.mode, title));
    }
  }
}
function scheduleActorBadges(app){ setTimeout(()=>injectActorBadges(app), 0); }
Hooks.on("renderActorSheet", (app) => scheduleActorBadges(app));
Hooks.on("renderActorSheet5eCharacter", (app) => scheduleActorBadges(app));
Hooks.on("renderActorSheet5eNPC", (app) => scheduleActorBadges(app));
Hooks.on("renderActorSheet5eVehicle", (app) => scheduleActorBadges(app));
Hooks.on("renderApplicationV2", (app) => {
  const obj = app?.object ?? app?.document;
  if(obj?.documentName === "Actor") scheduleActorBadges(app);
});

Hooks.once("ready", () => console.log(`${MODULE_ID} | Ready v0.6.6.2`));
