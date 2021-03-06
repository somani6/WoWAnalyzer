import SPELLS from 'common/SPELLS';

import Module from 'Parser/Core/Module';
import isAtonement from './../Core/isAtonement';

class Castigation extends Module {
  healing = 0;
  damage = 0;

  _isCastigationBolt = false;

  on_initialized() {
    if (!this.owner.error) {
      this.active = this.owner.selectedCombatant.hasTalent(SPELLS.CASTIGATION_TALENT.id);
    }
  }

  on_byPlayer_damage(event) {
    if (event.ability.guid !== SPELLS.PENANCE.id || event.penanceBoltNumber !== 3) {
      this._isCastigationBolt = false;
      return;
    }

    this._isCastigationBolt = true;
    this.damage += event.amount;
  }

  on_byPlayer_heal(event) {
    const spellId = event.ability.guid;

    // Friendly Penance Healing
    if (spellId === SPELLS.PENANCE_HEAL.id) {
      if (event.penanceBoltNumber === 3) {
        this.healing += event.amount;
      }
    }

    // Offensive Penance Healing
    if (isAtonement(event)) {
      if (this._isCastigationBolt) {
        this.healing += event.amount;
      }
    }
  }

}

export default Castigation;
