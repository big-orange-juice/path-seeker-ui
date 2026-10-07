<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import CollectionCandidateDiffDialog from '@/components/collections/CollectionCandidateDiffDialog.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useCollectionImport } from '@/composables/useCollectionImport';
import {
  COLLECTION_IMPORT_MAX_ROWS,
  batchStatusText,
  parseImageLinks,
  readString,
  targetTypeText,
} from '@/types/collection-import';
import type { CollectionImportCandidate, JsonValue } from '@/types/collection-import';
import type { MuseumResponse, MuseumResponseListTotalPageResult } from '@/types/museum';

definePageMeta({
  middleware: 'admin-auth',
});

const actionFeedback = useActionFeedback();
const runtimeConfig = useRuntimeConfig();
const { request } = useApiClient();

const importer = useCollectionImport();
const {
  activeMuseumId,
  step,
  batch,
  sources,
  parseResult,
  submitResult,
  candidates,
  selectedCandidateIds,
  pageIndex,
  totalPages,
  total,
  rowsPerPage,
  selectedFile,
  uploadPercent,
  busy,
  error,
  backendUnavailable,
  hasBatch,
  confirmableCandidates,
  selectedCount,
  createCount,
  updateCount,
  failedCount,
  skippedCount,
} = importer;

const detailCandidate = shallowRef<CollectionImportCandidate | null>(null);
const detailOpen = shallowRef(false);
const fileInput = shallowRef<HTMLInputElement | null>(null);
const imageFiles = shallowRef<File[]>([]);
const { uploadAttachment } = useUploadAttachment();
async function uploadImportImages(event: Event) {
  const input = event.target as HTMLInputElement;
  imageFiles.value = Array.from(input.files ?? []);
  busy.value = true;
  error.value = '';
  importer.imageAttachmentIds.value = [];
  try {
    const attachments = await Promise.all(imageFiles.value.map(file => uploadAttachment(file, 'image')));
    importer.imageAttachmentIds.value = attachments.map(attachment => String(attachment.fileId || '')).filter(Boolean);
    if (importer.imageAttachmentIds.value.length !== imageFiles.value.length) throw new Error('图片上传未返回附件 ID，请重新选择。');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '图片上传失败';
    importer.imageAttachmentIds.value = [];
    imageFiles.value = [];
    input.value = '';
  } finally { busy.value = false; }
}
usePlatformAssistantSelection(() => ({ museumId: activeMuseumId.value }));
/**
 * 人工列映射的目标字段：直接取后端回传的模板列（景点模板 31 列、文物模板 10 列），
 * 这里不再手抄一份列清单，避免模板列变化后对不上。
 */
const mappingFields = computed(() => {
  const header = sources.value[0]?.header;
  if (!header || typeof header !== 'object' || Array.isArray(header)) return [] as string[];
  const mapping = (header as Record<string, unknown>).mapping;
  return mapping && typeof mapping === 'object' && !Array.isArray(mapping) ? Object.keys(mapping) : [];
});
const sourceColumns = computed(() => {
  const header = sources.value[0]?.header;
  if (!header || typeof header !== 'object' || Array.isArray(header)) return [];
  const columns = (header as Record<string, unknown>).columns;
  return Array.isArray(columns) ? columns.map(String) : [];
});

const { data: museumData } = useAsyncData(
  'collection-import:museums',
  () => request<MuseumResponseListTotalPageResult<MuseumResponse>>('/api/museum-management/query', {
    method: 'POST',
    body: { pageIndex: 1, pageSize: 1000, keyword: null, status: null },
  }),
  {
    default: () => ({ list: [], pageIndex: 1, pageSize: 1000, total: 0, totalPages: 0 }),
  },
);

const museumOptions = computed(() =>
  (museumData.value.list ?? [])
    .filter((museum) => museum.id)
    .map((museum) => ({
      value: String(museum.id),
      label: String(museum.name || museum.museumCode || museum.id).trim() || String(museum.id),
    })),
);

watch(
  museumOptions,
  (options) => {
    if (!options.length) {
      activeMuseumId.value = '';
      return;
    }
    if (options.some((option) => option.value === activeMuseumId.value)) {
      return;
    }
    activeMuseumId.value = options[0]?.value ?? '';
  },
  { immediate: true },
);

onMounted(() => {
  // 提前探测后端接口：缺失时整页降级提示，而不是每个按钮各自失败
  void importer.probeBackend();
});

/** 从 draft_json 读取扁平字段；draft 结构由后端按 camelCase 序列化 */
const draftRecord = (candidate: CollectionImportCandidate): Record<string, JsonValue> | null => {
  const node = candidate.draft;
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return null;
  }
  return node as Record<string, JsonValue>;
};

const readDraftField = (candidate: CollectionImportCandidate, field: string): string => {
  const record = draftRecord(candidate);
  return readString(record?.[field]);
};

/** 候选行里展示的"名称"，来自 draft_json（拟写入字段） */
const candidateName = (candidate: CollectionImportCandidate): string =>
  readDraftField(candidate, 'name') || '（无名称）';

const candidateCode = (candidate: CollectionImportCandidate): string =>
  readDraftField(candidate, 'exhibitCode') || readDraftField(candidate, 'code') || '—';

const candidateImageCount = (candidate: CollectionImportCandidate): number =>
  parseImageLinks(candidate.imageLinks).resolved.length;

const candidateHasOverwrite = (candidate: CollectionImportCandidate): boolean => {
  if (candidate.targetId) {
    return true;
  }
  const node = candidate.overwrite;
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return false;
  }
  const fields = (node as Record<string, unknown>).fields;
  return Array.isArray(fields) && fields.length > 0;
};

const allSelected = computed(() =>
  Boolean(confirmableCandidates.value.length)
  && selectedCount.value === confirmableCandidates.value.length);

const stepIndex = computed(() => (step.value === 'prepare' ? 0 : step.value === 'preview' ? 1 : 2));

const stepLabels = ['1 下载模板与上传', '2 候选条目预览与确认', '3 提交结果'];

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  importer.selectFile(input.files?.[0] ?? null);
};

const clearFile = () => {
  importer.selectFile(null);
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const startParse = async () => {
  const ok = await importer.startImport();
  if (ok) {
    actionFeedback.success('文件已解析，请核对候选条目后逐条或批量确认。');
  }
};

const handleDownloadTemplate = async () => {
  // 模板分文物/景点两套，按当前选中的目的地取对应列集
  const ok = await importer.downloadTemplate(activeMuseumId.value);
  if (ok) {
    actionFeedback.success('模板已开始下载。');
  }
};

const openDetail = (candidate: CollectionImportCandidate) => {
  detailCandidate.value = candidate;
  detailOpen.value = true;
};

const handleConfirmOne = async (candidateId: string) => {
  detailOpen.value = false;
  const ok = await importer.confirmCandidates([candidateId]);
  if (ok) {
    actionFeedback.success('已确认该行；提交入库后才会写入。');
  }
};

const handleSkipOne = async (candidateId: string) => {
  detailOpen.value = false;
  const ok = await importer.skipCandidates([candidateId]);
  if (ok) {
    actionFeedback.success('已跳过该行。');
  }
};

const handleConfirmSelected = async () => {
  const ok = await importer.confirmCandidates();
  if (ok) {
    actionFeedback.success(`已确认 ${selectedCount.value} 行；提交入库后才会写入。`);
  }
};

const handleSkipSelected = async () => {
  const count = selectedCount.value;
  const ok = await importer.skipCandidates();
  if (ok) {
    actionFeedback.success(`已跳过 ${count} 行。`);
  }
};

const handleCommit = async () => {
  const ok = await importer.commitImport();
  if (ok) {
    actionFeedback.success('已提交入库，请查看结果统计与错误报告。');
  }
};

const handleDownloadErrorReport = async () => {
  const ok = await importer.downloadErrorReport();
  if (ok) {
    actionFeedback.success('错误报告已开始下载。');
  }
};

const handleReset = () => {
  imageFiles.value = [];
  importer.resetSession();
  importer.selectFile(null);
  if (fileInput.value) {
    fileInput.value.value = '';
  }
  if (activeMuseumId.value) {
    void importer.probeBackend();
  }
};
</script>

<template>
  <div class="admin-page-frame flex flex-col gap-4">
    <div
      v-if="error"
      class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
    </div>

    <div
      v-if="backendUnavailable"
      class="rounded-[0.85rem] border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
      <p class="font-medium">典藏导入后端接口尚未上线</p>
      <p class="mt-1 text-xs leading-6">
        本页已按真实后端契约接入：<code>/api/CollectionImport/Create</code>、<code>/Parse</code>、
        <code>/PageCandidates</code>、<code>/Confirm</code>、<code>/Skip</code>、<code>/Commit</code>、
        <code>/Template</code>、<code>/ErrorReport</code>。当前仓库只有
        <code>ICollectionImportService</code> 契约（Service/WebApi 控制器未落地），因此请求会返回 501。
        控制器按上述路由补齐后，本页无需改动即可使用。
      </p>
    </div>

    <!-- 步骤条 -->
    <section class="warm-panel warm-outline rounded-[0.95rem] border border-border/70 px-4 py-3">
      <ol class="flex flex-wrap items-center gap-2 text-xs">
        <li
          v-for="(label, index) in stepLabels"
          :key="label"
          class="rounded-md px-2.5 py-1.5"
          :class="index === stepIndex
            ? 'bg-primary/14 text-primary ring-1 ring-inset ring-primary/30'
            : index < stepIndex
              ? 'text-muted-foreground'
              : 'text-muted-foreground/70'">
          {{ label }}
        </li>
      </ol>
    </section>

    <!-- 第一步：模板与上传 -->
    <section class="warm-panel warm-outline rounded-[0.95rem] border border-border/70 px-4 py-4">
      <h2 class="mb-3 text-sm font-medium">模板与文件</h2>
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-[280px] space-y-2">
          <label class="text-sm font-medium">目标场馆 / 目的地</label>
          <Select
            :model-value="activeMuseumId"
            :disabled="busy || hasBatch || !museumOptions.length"
            @update:model-value="activeMuseumId = $event">
            <option v-for="option in museumOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>

        <div class="min-w-[280px] flex-1 space-y-2">
          <label class="text-sm font-medium">导入文件（XLSX / CSV，单批上限 {{ COLLECTION_IMPORT_MAX_ROWS }} 行）</label>
          <div class="flex items-center gap-2">
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              class="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:text-foreground"
              :disabled="busy || hasBatch"
              @change="handleFileChange">
            <Button v-if="selectedFile" variant="ghost" size="sm" :disabled="busy || hasBatch" @click="clearFile">
              清除
            </Button>
          </div>
          <p v-if="selectedFile" class="text-xs text-muted-foreground">
            已选：{{ selectedFile.name }}（{{ Math.max(1, Math.round(selectedFile.size / 1024)) }} KB）
          </p>
        </div>

        <div class="grid gap-2">
          <label class="text-sm">导入图片（表格中按原始文件名绑定景点或文物）</label>
          <input type="file" accept="image/*" multiple :disabled="busy || hasBatch" @change="uploadImportImages">
          <p class="text-xs text-muted-foreground">{{ imageFiles.map(file => file.name).join('、') || '可选；图片文件名列支持逗号分隔多张图片。' }}</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <Button variant="outline" :disabled="busy" @click="handleDownloadTemplate">
            下载导入模板
          </Button>
          <Button :disabled="busy || hasBatch || !selectedFile || !activeMuseumId" @click="startParse">
            {{ busy ? '处理中…' : '上传并解析' }}
          </Button>
          <Button v-if="hasBatch" variant="outline" :disabled="busy" @click="handleReset">
            新建批次
          </Button>
        </div>
      </div>

      <p class="mt-2 text-xs text-muted-foreground">
        模板按目标目的地区分：文物模板为展品字段；景点模板包含景点基础字段、补充资料（写成「键=值」，多条用分号分隔，也可自行增加「补充资料·键名」列）与深度档案（时间线、记忆点等多值字段用分号分隔）。
      </p>

      <div v-if="uploadPercent > 0 && uploadPercent < 100" class="mt-3">
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div class="h-full bg-primary transition-all" :style="{ width: `${uploadPercent}%` }" />
        </div>
        <p class="mt-1 text-xs text-muted-foreground" role="status">文件上传中 {{ uploadPercent }}%…（上传完成后进入后台解析）</p>
      </div>

      <div v-if="busy" class="mt-3 text-xs text-muted-foreground" role="status">后台解析与校验中，请稍候…</div>

      <div v-if="hasBatch && batch" class="mt-4 rounded-md border px-3 py-2 text-xs">
        <p>
          批次 <b>{{ batch.id }}</b> · {{ batchStatusText(batch.status) }} · 版本 {{ batch.version }}
          <template v-if="batch.templateVersion"> · 模板 {{ batch.templateVersion }}</template>
          <template v-if="batch.rowCount"> · 数据行 {{ batch.rowCount }}</template>
        </p>
        <p v-if="sources.length" class="mt-1 text-muted-foreground">
          来源文件：{{ sources.map((source) => source.fileName || source.attachmentId).join('、') }}
          <template v-if="sources[0]?.sheetName"> / 工作表 {{ sources[0]?.sheetName }}</template>
          <template v-if="sources[0]?.parseError"> / 解析错误：{{ sources[0]?.parseError }}</template>
        </p>
        <ul v-if="parseResult && (parseResult.missingColumns.length || parseResult.unmappedColumns.length || parseResult.duplicateColumns.length)" class="mt-1 space-y-0.5 text-amber-200">
          <li v-if="parseResult.missingColumns.length">缺失模板列：{{ parseResult.missingColumns.join('、') }}</li>
          <li v-if="parseResult.unmappedColumns.length">未映射列：{{ parseResult.unmappedColumns.join('、') }}</li>
          <li v-if="parseResult.duplicateColumns.length">重复列：{{ parseResult.duplicateColumns.join('、') }}</li>
          <li v-if="parseResult.mappingRequiresConfirmation">列映射结论与模板不一致，请核对后再确认。</li>
        </ul>
      </div>
    </section>

    <!-- 第二步：候选条目预览 -->
    <section v-if="sourceColumns.length && step !== 'prepare' && !batch?.createCount && !batch?.updateCount" class="warm-panel rounded-md border p-4">
      <h3>人工列映射</h3>
      <div class="mt-2 grid gap-2 sm:grid-cols-2">
        <label v-for="field in mappingFields" :key="field" class="flex items-center gap-2 text-sm">
          <span>{{ field }}</span>
          <select v-model="importer.columnMapping.value[field]" :disabled="busy" class="rounded border p-1">
            <option value="">使用自动映射</option>
            <option v-for="column in sourceColumns" :key="column" :value="column">{{ column }}</option>
          </select>
        </label>
      </div>
      <Button class="mt-3" :disabled="busy" @click="importer.reparseMapping()">应用映射并重新解析</Button>
      <label class="ml-3 text-sm"><input v-model="importer.mappingAccepted.value" type="checkbox" :disabled="busy"> 已核对列映射及缺失字段</label>
    </section>
    <section v-if="step !== 'prepare'" class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3 px-1">
        <div class="text-sm text-muted-foreground">
          候选条目共 {{ total }} 条，当前第 {{ pageIndex }} / {{ Math.max(totalPages, 1) }} 页（每页 {{ rowsPerPage }} 行）
          <span v-if="selectedCount" class="ml-2 text-primary">已选 {{ selectedCount }} 行</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" :disabled="busy" @click="importer.loadCandidates(1)">
            刷新候选
          </Button>
          <Button variant="outline" size="sm" :disabled="busy || pageIndex <= 1" @click="importer.loadCandidates(pageIndex - 1)">
            上一页
          </Button>
          <Button variant="outline" size="sm" :disabled="busy || pageIndex >= Math.max(totalPages, 1)" @click="importer.loadCandidates(pageIndex + 1)">
            下一页
          </Button>
        </div>
      </div>

      <div class="warm-panel warm-outline overflow-hidden rounded-[0.95rem] border border-border/70">
        <table class="w-full min-w-[1040px] text-sm">
          <thead class="bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th class="w-10 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  class="h-4 w-4"
                  :checked="allSelected"
                  :disabled="busy || !confirmableCandidates.length"
                  @change="importer.toggleAllCandidates(($event.target as HTMLInputElement).checked)">
              </th>
              <th class="px-3 py-2 text-left">行号</th>
              <th class="px-3 py-2 text-left">对象</th>
              <th class="px-3 py-2 text-left">业务编码</th>
              <th class="px-3 py-2 text-left">匹配</th>
              <th class="px-3 py-2 text-left">差异</th>
              <th class="px-3 py-2 text-left">图片</th>
              <th class="px-3 py-2 text-left">状态</th>
              <th class="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!candidates.length">
              <td colspan="9" class="px-3 py-6 text-center text-sm text-muted-foreground">
                没有候选条目。若刚解析完请点击"刷新候选"。
              </td>
            </tr>
            <tr v-for="candidate in candidates" :key="candidate.id" class="border-t">
              <td class="px-3 py-2">
                <input
                  type="checkbox"
                  class="h-4 w-4"
                  :checked="selectedCandidateIds.includes(candidate.id)"
                  :disabled="busy || candidate.status !== 0"
                  @change="importer.toggleCandidate(candidate.id, ($event.target as HTMLInputElement).checked)">
              </td>
              <td class="px-3 py-2 text-muted-foreground">{{ candidate.rowNo }}</td>
              <td class="px-3 py-2">
                <p class="truncate">{{ candidateName(candidate) }}</p>
                <p class="text-xs text-muted-foreground">{{ targetTypeText(candidate.targetType) }}</p>
              </td>
              <td class="px-3 py-2 text-muted-foreground">{{ candidateCode(candidate) }}</td>
              <td class="px-3 py-2 text-xs">
                <template v-if="candidate.targetId">
                  <span class="text-amber-200">命中既有对象</span>
                  <span v-if="candidate.targetName" class="ml-1 text-muted-foreground">{{ candidate.targetName }}</span>
                </template>
                <span v-else class="text-muted-foreground">新建</span>
                <p v-if="candidate.matchEvidence" class="text-muted-foreground">{{ candidate.matchEvidence }}</p>
              </td>
              <td class="px-3 py-2 text-xs">
                <span v-if="candidateHasOverwrite(candidate)" class="text-amber-200">有覆盖差异</span>
                <span v-else class="text-muted-foreground">无</span>
                <span v-if="candidate.uncertainFields.length" class="ml-1 text-amber-200">
                  · {{ candidate.uncertainFields.length }} 项待确认
                </span>
              </td>
              <td class="px-3 py-2 text-xs text-muted-foreground">{{ candidateImageCount(candidate) }} 张</td>
              <td class="px-3 py-2 text-xs">
                {{ candidate.statusText }}
                <p v-if="candidate.errorMessage" class="text-destructive">{{ candidate.errorMessage }}</p>
              </td>
              <td class="px-3 py-2">
                <div class="flex gap-1.5">
                  <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="openDetail(candidate)">
                    差异详情
                  </Button>
                  <Button
                    v-if="candidate.status === 0"
                    variant="outline"
                    size="sm"
                    class="h-7 px-2 text-xs"
                    :disabled="busy"
                    @click="handleConfirmOne(candidate.id)">
                    确认
                  </Button>
                  <Button
                    v-if="candidate.status === 0"
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-xs"
                    :disabled="busy"
                    @click="handleSkipOne(candidate.id)">
                    跳过
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center gap-2 px-1">
        <Button variant="outline" :disabled="busy || !selectedCount" @click="handleConfirmSelected">
          批量确认（{{ selectedCount }}）
        </Button>
        <Button variant="outline" :disabled="busy || !selectedCount" @click="handleSkipSelected">
          批量跳过（{{ selectedCount }}）
        </Button>
        <Button :disabled="busy || !hasBatch" @click="handleCommit">
          {{ busy ? '提交中…' : '提交入库' }}
        </Button>
        <span class="text-xs text-muted-foreground">
          默认逐条确认；提交入库只写入已确认条目，未确认的行不会写入。
        </span>
      </div>
    </section>

    <!-- 第三步：结果统计 -->
    <section v-if="step === 'result'" class="warm-panel warm-outline rounded-[0.95rem] border border-border/70 px-4 py-4">
      <h2 class="mb-3 text-sm font-medium">提交结果</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div class="rounded-md border px-3 py-2">
          <p class="text-xs text-muted-foreground">新增</p>
          <p class="text-lg">{{ createCount }}</p>
        </div>
        <div class="rounded-md border px-3 py-2">
          <p class="text-xs text-muted-foreground">覆盖更新</p>
          <p class="text-lg">{{ updateCount }}</p>
        </div>
        <div class="rounded-md border px-3 py-2">
          <p class="text-xs text-muted-foreground">失败</p>
          <p class="text-lg" :class="failedCount ? 'text-destructive' : ''">{{ failedCount }}</p>
        </div>
        <div class="rounded-md border px-3 py-2">
          <p class="text-xs text-muted-foreground">跳过</p>
          <p class="text-lg">{{ skippedCount }}</p>
        </div>
        <div class="rounded-md border px-3 py-2">
          <p class="text-xs text-muted-foreground">批次状态</p>
          <p class="text-lg">{{ batch ? batchStatusText(batch.status) : '—' }}</p>
        </div>
      </div>

      <div v-if="submitResult?.issues.length" class="mt-4">
        <h3 class="mb-2 text-sm font-medium">行级问题（前 {{ submitResult.issues.length }} 条）</h3>
        <div class="max-h-64 overflow-y-auto rounded-md border">
          <table class="w-full text-xs">
            <thead class="bg-secondary/40 text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left">行号</th>
                <th class="px-3 py-2 text-left">字段</th>
                <th class="px-3 py-2 text-left">原因</th>
                <th class="px-3 py-2 text-left">原始值</th>
                <th class="px-3 py-2 text-left">业务编码</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="issue in submitResult.issues" :key="`${issue.rowNo}-${issue.field}-${issue.reason}`" class="border-t">
                <td class="px-3 py-1.5">{{ issue.rowNo }}</td>
                <td class="px-3 py-1.5">{{ issue.field }}</td>
                <td class="px-3 py-1.5">{{ issue.reason }}</td>
                <td class="px-3 py-1.5 text-muted-foreground">{{ issue.rawValue || '—' }}</td>
                <td class="px-3 py-1.5 text-muted-foreground">{{ issue.businessCode || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Button v-if="batch && [2, 5, 6].includes(batch.status)" variant="outline" :disabled="busy" @click="step = 'preview'; importer.loadCandidates(1)">查看剩余条目与失败记录</Button>
        <Button variant="outline" :disabled="busy || !hasBatch" @click="handleDownloadErrorReport">
          下载错误报告（XLSX）
        </Button>
        <Button variant="ghost" :disabled="busy" @click="handleReset">
          开始新的导入批次
        </Button>
        <span class="text-xs text-muted-foreground">批次、原始表格与错误报告一律保留，由运维手工清理。</span>
      </div>
    </section>

    <CollectionCandidateDiffDialog
      v-model:open="detailOpen"
      :candidate="detailCandidate"
      @confirm="handleConfirmOne"
      @skip="handleSkipOne" />
  </div>
</template>
