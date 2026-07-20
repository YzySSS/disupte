export const PRIMARY_REASONS = [
  '发布不适当内容对我造成骚扰',
  '存在欺诈骗钱行为',
  '此账号可能被盗用了',
  '存在侵权行为(侵犯知识产权、人身权)',
  '发布仿冒品信息',
  '冒充他人',
  '侵犯未成年人权益',
  '粉丝无底线追星行为',
];

export const ILLEGAL_TYPES = [
  '色情',
  '违法犯罪及违禁品',
  '赌博',
  '政治谣言',
  '暴恐血腥',
  '自杀自残',
  '网络暴力(开盒/侮辱等)',
  '其他违规内容',
];

export const FRAUD_TYPES = [
  '金融诈骗（贷款/提额/代开/套现等）',
  '网络兼职刷单诈骗',
  '返利诈骗',
  '网络交友诈骗',
  '虚假投资理财诈骗',
  '赌博诈骗',
  '收款不发货',
  '仿冒他人诈骗',
  '免费送诈骗',
  '游戏相关诈骗（代练/充值等）',
  '其他诈骗行为',
];

export function isValidReasonSelection(primaryReason, secondaryReason = '') {
  if (!PRIMARY_REASONS.includes(primaryReason)) return false;
  if (primaryReason === PRIMARY_REASONS[0]) return ILLEGAL_TYPES.includes(secondaryReason);
  if (primaryReason === PRIMARY_REASONS[1]) return FRAUD_TYPES.includes(secondaryReason);
  return secondaryReason === '';
}
