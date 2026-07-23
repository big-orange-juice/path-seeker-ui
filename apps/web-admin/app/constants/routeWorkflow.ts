/**
 * 路线发布 / 审核工作流（对齐 docs/41-route-status-workflow.md）
 * 产品角色：管理员=ADMIN，导游=CREATOR
 *
 * 发布状态文案：未上架(1) / 已上架(2) / 已下线(3)
 *
 * 管理员数据权限：
 * | 场景 | 列表 | 详情查看 | 编辑内容 | 删除 | 其它 |
 * | 本人未上架/已下线（免审） | ✅ | ✅ | ✅（待审不可改） | ✅ 未上架 | 上架/下线 |
 * | 他人未上架（非待审） | ✅ | ❌ | ❌ | ✅ | 上架/下线 |
 * | 他人未上架（待审核） | ✅ | ✅ 只读（列表「审核」） | ❌ | ✅ | 审核通过/驳回；上架/下线 |
 * | 他人已下线 | ✅ | ❌ | ❌ | ❌（仅未上架可删） | 上架 |
 * | 已上架（本人/他人） | ✅ | ✅ 只读 | ❌ | ❌ | 下线 |
 *
 * 原则：管理员可对任意路线上架/下线，可删导游未上架路线；不可改他人内容，仅审核。
 * 导游：本人全流程；他人仅已上架只读。
 */

export const ROUTE_ROLE_ADMIN = 'ADMIN';
export const ROUTE_ROLE_GUIDE = 'CREATOR';

/** 发布状态 */
export const PUBLISH_DRAFT = 1;
/** @deprecated 语义上请用「未上架」文案；常量名保留兼容 */
export const PUBLISH_UNPUBLISHED = PUBLISH_DRAFT;
export const PUBLISH_ONLINE = 2;
export const PUBLISH_OFFLINE = 3;

/** 审核状态 */
export const AUDIT_NONE = 0;
export const AUDIT_PENDING = 1;
export const AUDIT_PASSED = 2;
export const AUDIT_REJECTED = 3;

export const ROUTE_PUBLISH_STATUS_OPTIONS = [
  { label: '全部发布', value: -1 },
  { label: '未上架', value: PUBLISH_DRAFT },
  { label: '已上架', value: PUBLISH_ONLINE },
  { label: '已下线', value: PUBLISH_OFFLINE },
] as const;

export const ROUTE_AUDIT_STATUS_OPTIONS = [
  { label: '全部审核', value: -1 },
  { label: '未提交', value: AUDIT_NONE },
  { label: '待审核', value: AUDIT_PENDING },
  { label: '已通过', value: AUDIT_PASSED },
  { label: '已驳回', value: AUDIT_REJECTED },
] as const;

export type RouteRoleCode = typeof ROUTE_ROLE_ADMIN | typeof ROUTE_ROLE_GUIDE | string;

export interface RouteWorkflowRecord {
  id?: string;
  publishStatus: number;
  auditStatus: number;
  auditRemark?: string | null;
  auditRequired?: boolean;
  canEdit?: boolean | null;
  ownerId?: string | null;
  isGenerating?: boolean;
}

export interface RouteWorkflowContext {
  roleCode: RouteRoleCode;
  adminId?: string | null;
}

export interface RouteWorkflowActions {
  canEditContent: boolean;
  /** 是否允许打开详情/工作台（查看或编辑） */
  canOpenDetail: boolean;
  canSubmitAudit: boolean;
  canAudit: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canDelete: boolean;
  isOwner: boolean;
  isReadOnlyPeer: boolean;
  /** 管理员对他人未上架：列表可见、无详情/操作 */
  isListOnly: boolean;
  /** 列表主按钮文案；空字符串表示不展示打开按钮 */
  openLabel: string;
}

export interface RouteStatusPresentation {
  primaryLabel: string;
  primaryClass: string;
  secondaryLabel: string;
  secondaryClass: string;
  remark: string;
  title: string;
}

export const normalizeRoleCode = (value: string | null | undefined): string => {
  const raw = String(value ?? '').trim();
  const code = raw.toUpperCase();
  if (code === 'ADMIN' || code === 'ADMINISTRATOR' || raw === '管理员') {
    return ROUTE_ROLE_ADMIN;
  }
  if (
    code === 'CREATOR'
    || code === 'GUIDE'
    || code === 'CURATOR'
    || raw === '导游'
    || raw === '策展人'
  ) {
    return ROUTE_ROLE_GUIDE;
  }
  return code;
};

export const isAdminRole = (roleCode: string | null | undefined) =>
  normalizeRoleCode(roleCode) === ROUTE_ROLE_ADMIN;

export const isGuideRole = (roleCode: string | null | undefined) =>
  normalizeRoleCode(roleCode) === ROUTE_ROLE_GUIDE;

export const roleDisplayName = (roleCode: string | null | undefined, roleName?: string | null) => {
  const code = normalizeRoleCode(roleCode || roleName);
  if (isAdminRole(code)) {
    return '管理员';
  }
  if (isGuideRole(code)) {
    return '导游';
  }
  const name = String(roleName ?? '').trim();
  // 过滤后端码值，避免顶栏直接展示 CREATOR / ADMIN
  if (name && !/^(ADMIN|ADMINISTRATOR|CREATOR|GUIDE|CURATOR)$/i.test(name)) {
    return name;
  }
  return '后台账号';
};

/**
 * 严格归属：ownerId / adminId 任一缺失时视为「非本人」，
 * 避免管理员在缺字段时误得编辑/删除权。
 */
export const isOwnedBy = (record: RouteWorkflowRecord, adminId?: string | null) => {
  const owner = String(record.ownerId ?? '').trim();
  const self = String(adminId ?? '').trim();
  if (!owner || !self) {
    return false;
  }
  return owner === self;
};

const resolveAuditRequired = (record: RouteWorkflowRecord, asGuideDefault: boolean) => {
  if (typeof record.auditRequired === 'boolean') {
    return record.auditRequired;
  }
  return asGuideDefault;
};

/** 发布态是否为「未上架」（原草稿） */
export const isUnpublished = (publishStatus: number) =>
  Number(publishStatus ?? 0) === PUBLISH_DRAFT;

/**
 * 内容是否允许修改（本地策略）。
 * 管理员：仅本人 + 未上架/已下线 + 非待审（禁止改他人未上架/已下线）。
 * 导游：仅本人 + 未上架(未提交/已通过/已驳回) 或 已下线。
 */
export const canEditContentByPolicy = (
  record: RouteWorkflowRecord,
  ctx: RouteWorkflowContext,
): boolean => {
  const admin = isAdminRole(ctx.roleCode);
  const guide = isGuideRole(ctx.roleCode);
  const owner = isOwnedBy(record, ctx.adminId);
  const publish = Number(record.publishStatus ?? 0);
  const audit = Number(record.auditStatus ?? 0);

  if (!owner) {
    return false;
  }
  if (publish === PUBLISH_ONLINE) {
    return false;
  }
  if (audit === AUDIT_PENDING) {
    return false;
  }

  if (admin) {
    // 管理员只改自己的免审/名下路线，不改导游未上架内容
    return publish === PUBLISH_DRAFT || publish === PUBLISH_OFFLINE;
  }

  if (guide) {
    if (publish === PUBLISH_OFFLINE) {
      return true;
    }
    if (publish === PUBLISH_DRAFT) {
      return audit === AUDIT_NONE || audit === AUDIT_PASSED || audit === AUDIT_REJECTED;
    }
  }

  return false;
};

/**
 * 是否允许打开详情。
 * 管理员：本人任意状态；他人「已上架」可看；他人「待审核」可只读查看以便审核。
 * 导游：本人；或他人已上架只读。
 */
export const canOpenDetailByPolicy = (
  record: RouteWorkflowRecord,
  ctx: RouteWorkflowContext,
): boolean => {
  const admin = isAdminRole(ctx.roleCode);
  const guide = isGuideRole(ctx.roleCode);
  const owner = isOwnedBy(record, ctx.adminId);
  const publish = Number(record.publishStatus ?? 0);
  const audit = Number(record.auditStatus ?? 0);
  const auditRequired = resolveAuditRequired(record, false);

  if (owner) {
    return true;
  }

  if (admin) {
    // 他人已上架：只读
    if (publish === PUBLISH_ONLINE) {
      return true;
    }
    // 他人待审核（未上架/已下线）：只读查看内容，配合审核操作
    if (
      auditRequired
      && audit === AUDIT_PENDING
      && (publish === PUBLISH_DRAFT || publish === PUBLISH_OFFLINE)
    ) {
      return true;
    }
    return false;
  }

  if (guide) {
    return publish === PUBLISH_ONLINE;
  }

  return false;
};

/**
 * 推导当前账号对路线的可操作集合。
 * 服务端 canEdit 仅作收紧：false 时禁止编辑。
 */
export const getRouteWorkflowActions = (
  record: RouteWorkflowRecord,
  ctx: RouteWorkflowContext,
): RouteWorkflowActions => {
  const admin = isAdminRole(ctx.roleCode);
  const guide = isGuideRole(ctx.roleCode);
  const owner = isOwnedBy(record, ctx.adminId);
  const generating = Boolean(record.isGenerating);
  const publish = Number(record.publishStatus ?? 0);
  const audit = Number(record.auditStatus ?? 0);
  const auditRequired = resolveAuditRequired(record, guide);

  const isReadOnlyPeer = !owner && publish === PUBLISH_ONLINE;

  let canEditContent = false;
  if (!generating) {
    canEditContent = canEditContentByPolicy(record, ctx);
    if (record.canEdit === false) {
      canEditContent = false;
    }
  }

  const canOpenDetail = !generating && canOpenDetailByPolicy(record, ctx);

  // 管理员对他人未上架/已下线且不可进详情：仅列表可见（待审除外，待审可只读查看）
  const isListOnly =
    admin
    && !owner
    && (publish === PUBLISH_DRAFT || publish === PUBLISH_OFFLINE)
    && !canOpenDetail;

  // 提交审核：导游本人 · 需审 · 未上架/已下线 · 未提交/已驳回
  const canSubmitAudit =
    !generating
    && guide
    && owner
    && auditRequired
    && (publish === PUBLISH_DRAFT || publish === PUBLISH_OFFLINE)
    && (audit === AUDIT_NONE || audit === AUDIT_REJECTED);

  // 审核：管理员对「需审 + 待审 + 未上架/已下线」；详情只读 + 审核操作
  const canAudit =
    !generating
    && admin
    && auditRequired
    && audit === AUDIT_PENDING
    && publish !== PUBLISH_ONLINE;

  // 上架前置：导游需审路线须审核通过；管理员可强制上架（含他人路线）
  const publishGateOk = admin || !auditRequired || audit === AUDIT_PASSED;

  // 上架：管理员任意未上架/已下线；导游仅本人且通过审核门槛
  const canPublish =
    !generating
    && (publish === PUBLISH_DRAFT || publish === PUBLISH_OFFLINE)
    && publishGateOk
    && (admin || (guide && owner));

  // 下线：管理员任意已上架；非管理员仅本人已上架
  const canUnpublish =
    !generating
    && publish === PUBLISH_ONLINE
    && (admin || owner);

  // 删除：未上架；本人非待审可删；管理员可删任意未上架（含导游待审）
  const canDelete =
    !generating
    && publish === PUBLISH_DRAFT
    && (admin || (owner && audit !== AUDIT_PENDING));

  // 列表主入口：可审合并为「审核」（打开只读详情，底部再审）；否则编辑/查看
  let openLabel = '';
  if (canOpenDetail) {
    if (canEditContent) {
      openLabel = '编辑';
    } else if (canAudit) {
      openLabel = '审核';
    } else {
      openLabel = '查看';
    }
  }

  return {
    canEditContent,
    canOpenDetail,
    canSubmitAudit,
    canAudit,
    canPublish,
    canUnpublish,
    canDelete,
    isOwner: owner,
    isReadOnlyPeer,
    isListOnly,
    openLabel,
  };
};

export const getRouteStatusPresentation = (
  record: RouteWorkflowRecord,
): RouteStatusPresentation => {
  const publish = Number(record.publishStatus ?? 0);
  const audit = Number(record.auditStatus ?? 0);
  const remark = String(record.auditRemark ?? '').trim();
  const auditRequired =
    typeof record.auditRequired === 'boolean' ? record.auditRequired : true;

  if (publish === PUBLISH_ONLINE) {
    return {
      primaryLabel: '已上架',
      primaryClass: 'bg-emerald-500/10 text-emerald-300',
      secondaryLabel: '',
      secondaryClass: '',
      remark,
      title: '已上架',
    };
  }

  if (publish === PUBLISH_OFFLINE) {
    return {
      primaryLabel: '已下线',
      primaryClass: 'bg-amber-500/10 text-amber-200',
      secondaryLabel: auditRequired && audit !== AUDIT_PASSED ? '需重审' : '',
      secondaryClass: 'bg-orange-500/10 text-orange-200',
      remark,
      title: auditRequired && audit !== AUDIT_PASSED ? '已下线 · 修改后需重新审核' : '已下线',
    };
  }

  // publish === 未上架
  if (audit === AUDIT_PENDING) {
    return {
      primaryLabel: '未上架',
      primaryClass: 'bg-slate-500/10 text-slate-300',
      secondaryLabel: '待审核',
      secondaryClass: 'bg-sky-500/10 text-sky-200',
      remark,
      title: '未上架 · 待审核',
    };
  }

  if (audit === AUDIT_PASSED) {
    return {
      primaryLabel: '未上架',
      primaryClass: 'bg-slate-500/10 text-slate-300',
      secondaryLabel: '已通过',
      secondaryClass: 'bg-emerald-500/10 text-emerald-200',
      remark,
      title: '未上架 · 已通过，可上架',
    };
  }

  if (audit === AUDIT_REJECTED) {
    return {
      primaryLabel: '未上架',
      primaryClass: 'bg-slate-500/10 text-slate-300',
      secondaryLabel: '已驳回',
      secondaryClass: 'bg-rose-500/10 text-rose-200',
      remark,
      title: remark ? `已驳回：${remark}` : '未上架 · 已驳回',
    };
  }

  if (!auditRequired) {
    return {
      primaryLabel: '未上架',
      primaryClass: 'bg-slate-500/10 text-slate-300',
      secondaryLabel: '免审',
      secondaryClass: 'bg-violet-500/10 text-violet-200',
      remark,
      title: '未上架 · 免审',
    };
  }

  return {
    primaryLabel: '未上架',
    primaryClass: 'bg-slate-500/10 text-slate-300',
    secondaryLabel: '未提交',
    secondaryClass: 'bg-muted text-muted-foreground',
    remark,
    title: '未上架 · 未提交审核',
  };
};

export const getEditLockMessage = (
  record: RouteWorkflowRecord,
  ctx?: RouteWorkflowContext,
): string => {
  const publish = Number(record.publishStatus ?? 0);
  const audit = Number(record.auditStatus ?? 0);
  const admin = ctx ? isAdminRole(ctx.roleCode) : false;
  const guide = ctx ? isGuideRole(ctx.roleCode) : false;
  const owner = ctx ? isOwnedBy(record, ctx.adminId) : false;

  if (admin && !owner && audit === AUDIT_PENDING) {
    return '待审核路线仅可查看。请点右下角「审核」通过或驳回。';
  }
  if (admin && !owner && (publish === PUBLISH_DRAFT || publish === PUBLISH_OFFLINE)) {
    return publish === PUBLISH_DRAFT
      ? '他人未上架路线内容只读，可在列表上架或删除。'
      : '他人已下线路线内容只读，可在列表重新上架。';
  }
  if (guide && !owner && publish === PUBLISH_ONLINE) {
    return '其他导游的已上架路线，仅可查看。';
  }
  if (!owner && publish === PUBLISH_ONLINE) {
    return '非本人路线，仅可查看。';
  }
  if (publish === PUBLISH_ONLINE) {
    return '路线已上架，请先下线后再修改。';
  }
  if (audit === AUDIT_PENDING) {
    return '审核中，内容已锁定，结束后可再修改。';
  }
  if (Boolean(record.isGenerating)) {
    return '路线生成中，请稍后再编辑。';
  }
  if (record.canEdit === false) {
    return '暂时不能编辑该路线。';
  }
  if (!owner) {
    return admin
      ? '他人路线内容只读，可审核、上架/下线或删除未上架路线。'
      : '仅路线归属人可编辑。';
  }
  return '当前状态不可编辑。';
};
