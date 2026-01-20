# Advantage and Disadvantage Icon (Foundry VTT)

Shows Advantage/Disadvantage as small **A / D** icons on the **D&D5e default character sheet**.

Badges can come from:
- Item configuration (Item Sheet → Details tab → Advantage/Disadvantage section), or
- Item Active Effects (e.g. `system.skills.ste.roll.mode = 1` / `-1`)

## Install
Foundry VTT → Add-on Modules → Install Module → paste:

https://github.com/MaceracilarLoncasi/advdis-badges/releases/download/v0.1.1/module.json

## Usage
### Item Details panel
Open an item → **Details** tab → configure:
- Mode (Advantage/Disadvantage)
- Skill(s) and/or Saving Throw(s)
- Note (tooltip text)

### Active Effects
If you don’t configure the item manually, the module can infer icons from Active Effects such as:
- `system.skills.<skill>.roll.mode` = `1` (Advantage) or `-1` (Disadvantage)
- `system.abilities.<ability>.save.roll.mode` = `1` / `-1`

## Settings
Module Settings → **Module Language**
- English (default)
- Türkçe
- Auto (Foundry)

## Compatibility
- Foundry VTT v13
- D&D5e system (default sheet)

## Credits
- Erozbey
- Maceracılar Loncası

## License
MIT
