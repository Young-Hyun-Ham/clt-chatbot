// app/lib/scenarioHelpers.js
// 시나리오 엔진 헬퍼 함수들

/**
 * 조건을 평가합니다.
 */
export const evaluateCondition = (slotValue, operator, conditionValue) => {
  const lowerCaseConditionValue = String(conditionValue ?? '').toLowerCase();
  const boolConditionValue = lowerCaseConditionValue === 'true';
  const boolSlotValue = String(slotValue ?? '').toLowerCase() === 'true';

  if (lowerCaseConditionValue === 'true' || lowerCaseConditionValue === 'false') {
    switch (operator) {
      case '==': return boolSlotValue === boolConditionValue;
      case '!=': return boolSlotValue !== boolConditionValue;
      default: return false;
    }
  }

  const numSlotValue = slotValue !== null && slotValue !== undefined && slotValue !== '' ? parseFloat(slotValue) : NaN;
  const numConditionValue = conditionValue !== null && conditionValue !== undefined && conditionValue !== '' ? parseFloat(conditionValue) : NaN;
  const bothAreNumbers = !isNaN(numSlotValue) && !isNaN(numConditionValue);

  switch (operator) {
    case '==': return String(slotValue ?? '') == String(conditionValue ?? '');
    case '!=': return String(slotValue ?? '') != String(conditionValue ?? '');
    case '>': return bothAreNumbers && numSlotValue > numConditionValue;
    case '<': return bothAreNumbers && numSlotValue < numConditionValue;
    case '>=': return bothAreNumbers && numSlotValue >= numConditionValue;
    case '<=': return bothAreNumbers && numSlotValue <= numConditionValue;
    case 'contains': return slotValue != null && String(slotValue).includes(String(conditionValue ?? ''));
    case '!contains': return slotValue == null || !String(slotValue).includes(String(conditionValue ?? ''));
    default:
      console.warn(`Unsupported operator used in condition: ${operator}`);
      return false;
  }
};
