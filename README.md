# Path Seeker UI

`Path Seeker UI` �ǡ��ؾ�Ѱ�١���Ŀ��ǰ�� monorepo����ǰ��������Ӧ�ã�

- `web-admin`������ B ����Ӫ�����ݱ༭�ĺ�̨ԭ�͡�
- `mp-wechat`������ C ���ο͵�΢��С����ˡ�

����ֿ⵱ǰ�ص���ǰ����Ϣ�ܹ���ҳ��ԭ�ͺͿ�˹�����֯����˷����ڱ��ֿ��ڡ�

## ��Ŀ����

�ؾ�Ѱ�ٵĺ���Ŀ�꣬�ǰѴ�ͳ����ݵ�������Ϊ������̽�� + ������� + ���·���������Ϸ�����顣ǰ�˲�����ˣ�

- ��̨����ݲ����ݹ������������á�����·�߱��ź���Ӫ������
- С������������롢�½��ƽ������⽻���ͽ���������

Ŀǰ�ֿ�״̬���£�

- `apps/web-admin` ���н������ĺ�̨��Ϣ�ܹ�չʾҳ��
- `apps/mp-wechat` �Դ��ڻ������ּܽ׶Σ���ҳ����Ĭ��ʾ��ҳ��
- `packages/*` ��ǰֻ�������������Լ����ȾԤ��������ǰ�����̨ UI ����
- `docs/` �±����˲�Ʒ�����������滮�͹��̲ο��ĵ���

## ����ջ

### Workspace

- `pnpm workspace`
- `TypeScript`

### B �˺�̨��`apps/web-admin`

- `Nuxt 4`
- `Vue 3`
- `Pinia`
- `Tailwind CSS`
- `shadcn-vue`
- `@vueuse/nuxt`
- `@nuxt/image`
- `@nuxt/icon`

����˵����

- ��ǰ `Nuxt` ����Ϊ `ssr: false`����ƫ��̨ԭ�ͺͽ����͹������档
- Ŀ¼�Ѳ��� Nuxt 4 �Ƽ��� `app/` �ṹ��

### ΢��С����ˣ�`apps/mp-wechat`

- `uni-app`
- `Vue 3`
- `Pinia`
- `Tailwind CSS`
- `GSAP`

## Ŀ¼�ṹ

```text
.
���� apps/
��  ���� web-admin/     # Nuxt 4 ��̨ԭ��
��  ���� mp-wechat/     # uni-app ΢��С����
���� packages/
��  ���� ts-shared/     # �����ȶ��Ŀ�� TS ��Լ
��  ���� game-renderer/ # ������ȾЭ����ǰ����Ⱦ����Ԥ��
���� docs/
��  ���� 01-product-solution.md
��  ���� 02-development-plan.md
��  ���� 03-frontend-skills-mcp-reference.md
���� scripts/
��  ���� install-all.ps1
��  ���� install-all.sh
���� package.json
���� pnpm-workspace.yaml
```

## ���ٿ�ʼ

### 1. ׼������

����ȷ�������Ѱ�װ��

- `Node.js`
- `pnpm`���ֿ������İ��������汾Ϊ `pnpm@11.7.0`

�����ʹ�� `corepack`������ֱ��ִ�У�

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

### 2. ��װ����

�ڲֿ��Ŀ¼ִ�У�

```bash
pnpm install
```

Windows Ҳ����ֱ��ʹ�ýű���

```powershell
./scripts/install-all.ps1
```

macOS / Linux��

```bash
bash ./scripts/install-all.sh
```

### 3. ������Ŀ

������̨ԭ�ͣ�

```bash
pnpm dev:web-admin
```

����С����� H5 ���԰汾��

```bash
pnpm dev:h5
```

����΢��С���򹹽�Ŀ�꣺

```bash
pnpm dev:mp-wexin
```

����˵����

- ���ű������ﱣ���� `wexin` �����ʷƴд����ʵ��ӳ����� `mp-weixin`��
- ������ϰ�߽�����Ӧ��Ŀ¼��Ҳ����ֱ��ʹ�ø��� `package.json` ��Ľű���

## ��������

| ���� | ˵�� |
| --- | --- |
| `pnpm dev:web-admin` | ���� Nuxt ��̨�������� |
| `pnpm build:web-admin` | ������̨ |
| `pnpm dev:h5` | ���� uni-app �� H5 ���� |
| `pnpm dev:mp-wexin` | ����΢��С����Ŀ�� |
| `pnpm build:mp-wexin` | ����΢��С����Ŀ�� |
| `pnpm typecheck` | �ݹ�ִ�� workspace ���ͼ�� |

## ��ǰҳ����ģ��

### `apps/web-admin`

��ǰ��̨��������һ��Χ�Ʋ�Ʒ������ҳ��Ǽܣ�

- `/`����̨������չʾ��Ŀ��λ��ҵ��ģ�͡�����������������̡�
- `/collections`���ݲ����ݹ�����ǿ�������ʲ�����¼�����ȼ���
- `/routes`������·����籾���š�
- `/operations`����Ӫ������ָ�꿴��� MVP ��Χ��

�ⲿ�ָ��ӽ�����Ʒ�������ӻ���̨ԭ�͡����������Ѿ��Ӻú�˵�����ϵͳ��

### `apps/mp-wechat`

��ǰ���ǻ������ּ�״̬��

- ����� `uni-app` ���̳�ʼ����
- �����ö�˽ű������� H5 �� `mp-weixin`��
- ��ҳĿǰ����Ĭ��ʾ�����ݣ�ҵ��ҳ����δ��ʼ��ء�

## ������˵��

| ���� | ��; |
| --- | --- |
| `@path-seeker/ts-shared` | ֻ�����Ѿ��ȶ����һᱻ����Ӧ�ù�ͬ���ѵ������볣�� |
| `@path-seeker/game-renderer` | Ϊ��������Ԥ�� / С��������Ⱦ�㱣����СЭ����� |

## �ĵ�����

���Ҫ������ȫҵ�񱳾���滮�����ȿ���Щ�ĵ���

- `docs/01-product-solution.md`����Ʒ������ҵ��ģ�͡�
- `docs/02-development-plan.md`��ǰ��˲�֡�����ջ�ͽ׶�ʵʩ���顣
- `docs/03-frontend-skills-mcp-reference.md`����ǰǰ�� skill / MCP �ο���¼��

## ����˵��

- ���ֿ������ǰ�˹������������� `.NET` ��˷���ʵ�֡�
- `web-admin` ��ǰ��ƫ��Ϣ�ܹ���ҳ��ԭ�ͣ���̨����ȱ����� `apps/web-admin/app/components` �ڲ����������� `ui-admin` ����
- `mp-wechat` ��ǰ��ƫ���ּܣ��ɴ�������ҳ���½ڵ�ͼ��������Ⱦ�������߼����ƽ���
- �����Ҫ����Э�飬���ȳ����� `packages/ts-shared` �� `packages/game-renderer`��ǰ���������Ѿ�������Ӧ�ù�ͬ���ѡ�
- `docs/02-development-plan.md` �������Ǹ����ڵ�Ŀ��ṹ����ǰ�ֿⰴ������������� app ����ء��Ĳ���ִ�С�
