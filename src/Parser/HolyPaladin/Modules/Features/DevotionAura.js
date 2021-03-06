import React from 'react';

import SPELLS from 'common/SPELLS';
import makeWclUrl from 'common/makeWclUrl';
import SpellIcon from 'common/SpellIcon';
import { formatThousands, formatNumber } from 'common/format';

import LazyLoadStatisticBox from 'Main/LazyLoadStatisticBox';

import ModuleComponent from 'Parser/Core/ModuleComponent';

// Protection of Tyr is applied to everyone that benefits from the AM effect. This is simply the easiest way to see if someone is affected by AM, other more robust solutions take a lot more effort/complexity.
const PROTECTION_OF_TYR_ID = 211210;
const DEVOTION_AURA_DAMAGE_REDUCTION = 0.2;

/**
 * Falling damage is considered "pure" or w/e damage meaning it doesn't get reduced by damage reductions. The ability description of such an event can look like this: {
		"name": "Falling",
		"guid": 3,
		"type": 1,
		"abilityIcon": "inv_axe_02.jpg"
	},
 * `type: 1` seems to only be used by Falling, but I was unable to verify this. I want to ignore this kind of damage taken. I figured the savest solution would be to filter by ability id instead of type, but if you find another such ability that needs to be ignored and it has `type: 1` while nothing else does, we may want to refactor this.
 */
// const THIS_MIGHT_BE_PURE_ABILITY_TYPE_ID = 1;
const FALLING_DAMAGE_ABILITY_ID = 3;

class DevotionAura extends ModuleComponent {
  get damageReducedDuringAuraMastery() {
    return this.state.totalDamageTakenDuringAuraMastery / (1 - DEVOTION_AURA_DAMAGE_REDUCTION) * DEVOTION_AURA_DAMAGE_REDUCTION;
  }
  get damageReducedOutsideAuraMastery() {
    return this.state.totalDamageTakenOutsideAuraMastery / (1 - DEVOTION_AURA_DAMAGE_REDUCTION) * DEVOTION_AURA_DAMAGE_REDUCTION;
  }
  get damageReduced() {
    return this.damageReducedDuringAuraMastery + this.damageReducedOutsideAuraMastery;
  }

  constructor(props) {
    super(props);
    this.state = {
      active: this.owner.selectedCombatant.hasTalent(SPELLS.DEVOTION_AURA_TALENT.id),
      totalDamageTakenDuringAuraMastery: 0,
      totalDamageTakenOutsideAuraMastery: 0,
    };
  }

  on_toPlayer_damage(event) {
    const spellId = event.ability.guid;
    if (spellId === FALLING_DAMAGE_ABILITY_ID) {
      return;
    }
    const isAuraMasteryActive = this.owner.selectedCombatant.getBuffs(PROTECTION_OF_TYR_ID, event.timestamp).find(buff => buff.sourceID === this.owner.playerId);
    if (!isAuraMasteryActive) {
      this.setState(state => ({
        totalDamageTakenOutsideAuraMastery: state.totalDamageTakenOutsideAuraMastery + event.amount + (event.absorbed || 0),
      }));
    }
  }

  load() {
    const amDamageTakenPromise = fetch(makeWclUrl(`report/tables/damage-taken/${this.owner.report.code}`, {
      start: this.owner.fight.start_time,
      end: this.owner.fight.end_time,
      filter: `(IN RANGE FROM type='applybuff' AND ability.id=${PROTECTION_OF_TYR_ID} AND source.name='${this.owner.selectedCombatant.name}' TO type='removebuff' AND ability.id=${PROTECTION_OF_TYR_ID} AND source.name='${this.owner.selectedCombatant.name}' GROUP BY target ON target END)`,
    }))
      .then(response => response.json())
      .then((json) => {
        console.log('Received AM damage taken', json);
        if (json.status === 400 || json.status === 401) {
          throw json.error;
        } else {
          this.setState({
            totalDamageTakenDuringAuraMastery: json.entries.reduce((damageTaken, entry) => damageTaken + entry.total, 0),
          });
        }
      });

    return amDamageTakenPromise;
  }

  render() {
    if (!this.active) {
      return null;
    }
    const fightDuration = this.owner.fightDuration;

    return (
      <LazyLoadStatisticBox
        loader={this.load.bind(this)}
        icon={<SpellIcon id={SPELLS.DEVOTION_AURA_TALENT.id} />}
        value={`≈${formatNumber(this.damageReduced / fightDuration * 1000)} DRPS`}
        label="Estimated damage reduced"
        tooltip={`The total estimated damage reduced <b>by the passive</b> was ${formatThousands(this.damageReducedOutsideAuraMastery)} (${formatNumber(this.damageReducedOutsideAuraMastery / fightDuration * 1000)} DRPS). This has high accuracy.<br />
          The total estimated damage reduced <b>during Aura Mastery</b> was ${formatThousands(this.damageReducedDuringAuraMastery)} (${formatNumber(this.damageReducedDuringAuraMastery / fightDuration * 1000)} DRPS). This has a 99% accuracy.<br /><br />

          This is the lowest possible value. This value is pretty accurate for this log if you are looking at the actual gain over not having Devotion Aura bonus at all, but the gain may end up higher when taking interactions with other damage reductions into account.<br /><br />

          Calculating exact Devotion Aura damage reduced is very time and resource consuming. This gets the total damage taken during and outside Aura Mastery and calculates the damage reduced for those totals by taking 20% of the original damage taken during Aura Mastery and 20% of all damage you've taken outside Aura Mastery. Even though the 20% damage taken is split among other nearby players, using your personal damage taken should average it out very closely. More extensive tests that go over all damage events and that is aware of the exact Devotion Aura reduction at each event have shown that this is usually a close approximation.`}
      />
    );
  }
}

export default DevotionAura;
