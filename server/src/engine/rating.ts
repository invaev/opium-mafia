export interface RatingInput {
  role: string;
  team: string;
  won: boolean;
  alive: boolean;
  fouls: number;
  techKill: boolean;
  saves?: number;
  bodyguardTraded?: boolean;
  sheriffFoundDon?: boolean;
  sheriffShotMafia?: boolean;
  framerSuccessful?: boolean;
  enforcerUsed?: boolean;
  maniacKills?: number;
  werewolfActivated?: boolean;
}

export interface RatingResult {
  base: number;
  survival: number;
  roleBonus: number;
  penalties: number;
  total: number;
  details: string[];
}

export function calculateRating(input: RatingInput): RatingResult {
  const details: string[] = [];
  let base = 0;
  let survival = 0;
  let roleBonus = 0;
  let penalties = 0;

  if (input.won) {
    base = 10;
    details.push('Win: +10');
  } else {
    base = 2;
    details.push('Participation: +2');
  }

  if (input.alive && !input.techKill) {
    survival = input.won ? 3 : 1;
    details.push(`Survived to end: +${survival}`);
  }

  if (input.won) {
    switch (input.role) {
      case 'don':
        roleBonus += 5;
        details.push('Don leadership: +5');
        break;
      case 'sheriff':
        roleBonus += 5;
        details.push('Sheriff investigation: +5');
        if (input.sheriffFoundDon) {
          roleBonus += 3;
          details.push('Sheriff found Don: +3');
        }
        if (input.sheriffShotMafia) {
          roleBonus += 2;
          details.push('Sheriff deathshot hit mafia: +2');
        }
        break;
      case 'doctor':
        if (input.saves && input.saves > 0) {
          const saveBonus = input.saves * 3;
          roleBonus += saveBonus;
          details.push(`Doctor saves (${input.saves}x): +${saveBonus}`);
        } else {
          roleBonus += 2;
          details.push('Doctor: +2');
        }
        break;
      case 'bodyguard':
        if (input.bodyguardTraded) {
          roleBonus += 4;
          details.push('Bodyguard trade: +4');
        } else {
          roleBonus += 2;
          details.push('Bodyguard: +2');
        }
        break;
      case 'maniac':
        roleBonus += 8;
        details.push('Maniac victory: +8');
        if (input.maniacKills && input.maniacKills > 0) {
          const killBonus = input.maniacKills * 1;
          roleBonus += killBonus;
          details.push(`Maniac kills (${input.maniacKills}x): +${killBonus}`);
        }
        break;
      case 'werewolf':
        roleBonus += 6;
        details.push('Werewolf: +6');
        if (input.werewolfActivated) {
          roleBonus += 2;
          details.push('Werewolf activated: +2');
        }
        break;
      case 'hooker':
        roleBonus += 3;
        details.push('Hooker: +3');
        break;
      case 'seer':
        roleBonus += 3;
        details.push('Seer: +3');
        break;
      case 'framer':
        roleBonus += 3;
        details.push('Framer: +3');
        if (input.framerSuccessful) {
          roleBonus += 2;
          details.push('Framer caused wrong check: +2');
        }
        break;
      case 'enforcer':
        roleBonus += 3;
        details.push('Enforcer: +3');
        if (input.enforcerUsed) {
          roleBonus += 1;
          details.push('Enforcer kill used: +1');
        }
        break;
      case 'mafia':
        roleBonus += 2;
        details.push('Mafia member: +2');
        break;
      case 'civilian':
        roleBonus += 1;
        details.push('Civilian: +1');
        break;
    }
  } else {
    if (input.role === 'doctor' && input.saves && input.saves > 0) {
      const saveBonus = input.saves * 2;
      roleBonus += saveBonus;
      details.push(`Doctor saves on loss (${input.saves}x): +${saveBonus}`);
    }
    if (input.role === 'sheriff' && input.sheriffFoundDon) {
      roleBonus += 2;
      details.push('Sheriff found Don (loss): +2');
    }
    if (input.role === 'bodyguard' && input.bodyguardTraded) {
      roleBonus += 2;
      details.push('Bodyguard trade (loss): +2');
    }
  }

  if (input.fouls >= 1) {
    penalties -= 1;
    details.push('1st foul: -1');
  }
  if (input.fouls >= 2) {
    penalties -= 2;
    details.push('2nd foul: -2');
  }
  if (input.fouls >= 3 || input.techKill) {
    penalties -= 5;
    details.push('3rd foul (tech kill): -5');
  }

  const total = Math.max(-5, base + survival + roleBonus + penalties);

  console.log(`[RATING] role=${input.role} team=${input.team} won=${input.won} alive=${input.alive} fouls=${input.fouls} → base=${base} survival=${survival} roleBonus=${roleBonus} penalties=${penalties} total=${total}`);

  return {
    base,
    survival,
    roleBonus,
    penalties,
    total,
    details,
  };
}

