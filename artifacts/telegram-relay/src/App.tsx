import { useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpLeft,
  Bot,
  Check,
  ChevronLeft,
  CircleHelp,
  Cloud,
  Copy,
  LockKeyhole,
  MessageCircle,
  MessageSquareText,
  Printer,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3 text-[11px] font-semibold tracking-[0.14em] text-[#60716d]">
      <span className="h-px w-7 bg-[#8fa99b]" />
      <span>{children}</span>
    </div>
  );
}

function VariableRow({
  name,
  description,
  onCopy,
  copied,
}: {
  name: string;
  description: string;
  onCopy: (value: string) => void;
  copied: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#dcd9cd] py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <code className="mono text-[13px] font-semibold text-[#203b3a]">{name}</code>
        <p className="mt-1 text-sm leading-6 text-[#62716d]">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(name)}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#d4d4c7] px-3 py-2 text-xs font-semibold text-[#405551] transition-colors hover:border-[#8da99a] hover:bg-[#e8eee7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55836d]"
        aria-label={`نسخ اسم المتغير ${name}`}
        data-testid={`button-copy-${name.toLowerCase()}`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'تم النسخ' : 'نسخ الاسم'}
      </button>
    </div>
  );
}

function Home() {
  const [copiedVariable, setCopiedVariable] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  async function copyVariable(name: string) {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedVariable(name);
      setCopyMessage(`تم نسخ اسم المتغير ${name}`);
      window.setTimeout(() => {
        setCopiedVariable('');
        setCopyMessage('');
      }, 2200);
    } catch {
      setCopyMessage('تعذر النسخ تلقائياً. يمكنك تحديد اسم المتغير ونسخه يدوياً.');
      window.setTimeout(() => setCopyMessage(''), 3200);
    }
  }

  return (
    <main dir="rtl" className="guide-shell min-h-[100dvh] text-[#203238]">
      <header className="no-print sticky top-0 z-20 border-b border-[#dcd9cd] bg-[#f7f5ed]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-3.5 sm:px-8">
          <a href="#top" className="flex items-center gap-3" data-testid="link-home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#203a3d] text-[#c6d8c7]">
              <Bot size={20} strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-[#203238]">مِرساة</span>
              <span className="block text-[10px] tracking-[0.12em] text-[#7c8982]">دليل تشغيل الدعم</span>
            </span>
          </a>

          <nav aria-label="التنقل داخل الدليل" className="hidden items-center gap-7 md:flex">
            <a href="#setup" className="text-xs font-semibold text-[#586b66] transition-colors hover:text-[#244a42]" data-testid="link-nav-setup">الإعداد</a>
            <a href="#flow" className="text-xs font-semibold text-[#586b66] transition-colors hover:text-[#244a42]" data-testid="link-nav-flow">مسار الرسائل</a>
            <a href="#deploy" className="text-xs font-semibold text-[#586b66] transition-colors hover:text-[#244a42]" data-testid="link-nav-deploy">النشر والتشغيل</a>
          </nav>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d3d5c9] px-3.5 py-2 text-xs font-semibold text-[#3f5550] transition-colors hover:bg-[#e8eee7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55836d]"
            data-testid="button-print-guide"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">طباعة الدليل</span>
            <span className="sm:hidden">طباعة</span>
          </button>
        </div>
      </header>

      <div id="top" className="mx-auto max-w-[1240px] px-5 pb-20 pt-7 sm:px-8 sm:pt-10">
        <div className="mb-5 flex items-center gap-2 text-[11px] font-medium text-[#78857e]">
          <span>مساحة العمل</span>
          <ChevronLeft size={13} />
          <span className="text-[#36554c]">دليل ترحيل رسائل تيليجرام</span>
        </div>

        <section className="print-ink reveal relative isolate overflow-hidden rounded-[26px] bg-[#203a3d] px-6 py-9 text-[#f6f3e9] sm:px-10 sm:py-12 lg:px-14 lg:py-[58px]">
          <div className="hero-grid absolute inset-0 -z-10 opacity-70" />
          <div className="absolute -left-16 -top-24 -z-10 h-72 w-72 rounded-full border border-[#b6cbbb]/10" />
          <div className="absolute -left-2 top-12 -z-10 h-36 w-36 rounded-full border border-[#b6cbbb]/10" />
          <div className="grid gap-10 lg:grid-cols-[1fr_390px] lg:items-center">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d5e0d2]/20 bg-[#f3f0e7]/[0.06] px-3 py-1.5 text-[11px] font-medium text-[#d5e0d2]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9dc3a6]" />
                دليل عملي — إعداد مرة، وتشغيل بثقة
              </div>
              <h1 className="max-w-[700px] text-[34px] font-bold leading-[1.35] tracking-[-0.04em] sm:text-[46px] lg:text-[54px]">
                رسالة المستخدم تصل إليك.
                <br />
                <span className="text-[#b7d0bb]">وردّك يعود إليه.</span>
              </h1>
              <p className="mt-5 max-w-[560px] text-sm leading-7 text-[#d2ddd4] sm:text-base sm:leading-8">
                خطوات واضحة لربط بوت تيليجرام بصندوق دعمك وتشغيله على عامل سحابي. لا أسرار في هذه الصفحة، ولا حالة تشغيل مصطنعة — فقط ما تحتاجه لتجهيز المسار وفهمه.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#setup"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#c3d9c3] px-5 py-3 text-sm font-bold text-[#203a3d] transition-transform hover:-translate-y-0.5"
                  data-testid="link-start-setup"
                >
                  ابدأ الإعداد <ArrowDownLeft size={16} />
                </a>
                <a
                  href="#flow"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#d5e0d2]/30 px-5 py-3 text-sm font-semibold text-[#ecf0e8] transition-colors hover:bg-white/5"
                  data-testid="link-follow-message"
                >
                  افهم مسار الرسالة <ArrowDownLeft size={16} />
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[380px]">
              <div className="absolute right-[38px] top-[52px] h-[146px] w-px border-r border-dashed border-[#9bc1a4]/55" />
              <div className="relative mb-4 flex items-center gap-4 rounded-2xl border border-[#d9e5d8]/15 bg-[#f2f1e9]/[0.07] p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#c6d8c7] text-[#203a3d]"><MessageCircle size={20} /></span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[#edf1e9]">رسالة واردة</span>
                  <span className="mt-1 block text-[11px] text-[#b8c9bd]">مستخدم ← بوت تيليجرام</span>
                </span>
                <ArrowDownLeft className="mr-auto text-[#a8c7ad]" size={17} />
              </div>
              <div className="relative mb-4 flex items-center gap-4 rounded-2xl border border-[#d9e5d8]/15 bg-[#f2f1e9]/[0.07] p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d8c39d] text-[#283c3b]"><MessageSquareText size={19} /></span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[#edf1e9]">تصل إلى الإدارة</span>
                  <span className="mt-1 block text-[11px] text-[#b8c9bd]">العامل السحابي يمررها</span>
                </span>
                <ArrowDownLeft className="mr-auto text-[#d8c39d]" size={17} />
              </div>
              <div className="relative flex items-center gap-4 rounded-2xl border border-[#9fc5a6]/30 bg-[#a8c9aa]/[0.12] p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#b9d4bc] text-[#203a3d]"><Bot size={20} /></span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[#edf1e9]">ردّ مرتبط بالمحادثة</span>
                  <span className="mt-1 block text-[11px] text-[#c9d9c9]">من الإدارة إلى المستخدم نفسه</span>
                </span>
                <ArrowUpLeft className="mr-auto text-[#b9d4bc]" size={17} />
              </div>
              <p className="mt-4 text-center text-[10px] leading-5 text-[#b8c9bd]">تصوّر لمسار الترحيل — ليس مؤشراً لحالة نظام حيّ</p>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <a href="#setup" className="group flex items-start gap-3 rounded-xl border border-[#dedbcf] bg-[#faf8f1] p-4 transition-colors hover:border-[#9bb4a1]" data-testid="link-card-setup">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e4ece1] text-[#42644f]"><LockKeyhole size={17} /></span>
            <span><span className="block text-sm font-bold">مفاتيح الإعداد</span><span className="mt-1 block text-xs leading-5 text-[#718078]">أين تضع BOT_TOKEN و ADMIN_ID بأمان</span></span>
          </a>
          <a href="#flow" className="group flex items-start gap-3 rounded-xl border border-[#dedbcf] bg-[#faf8f1] p-4 transition-colors hover:border-[#9bb4a1]" data-testid="link-card-flow">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1e9d9] text-[#806b44]"><MessageSquareText size={17} /></span>
            <span><span className="block text-sm font-bold">مسار الرد</span><span className="mt-1 block text-xs leading-5 text-[#718078]">كيف تعود الإجابة إلى صاحب الرسالة</span></span>
          </a>
          <a href="#deploy" className="group flex items-start gap-3 rounded-xl border border-[#dedbcf] bg-[#faf8f1] p-4 transition-colors hover:border-[#9bb4a1]" data-testid="link-card-deploy">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e3e9e8] text-[#48636a]"><Cloud size={17} /></span>
            <span><span className="block text-sm font-bold">النشر السحابي</span><span className="mt-1 block text-xs leading-5 text-[#718078]">تجهيز العامل واختبار التشغيل يدوياً</span></span>
          </a>
        </div>

        <section id="setup" className="reveal-delay mt-20 scroll-mt-28">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div className="pt-1">
              <SectionLabel>٠١ — الإعداد</SectionLabel>
              <h2 className="text-3xl font-bold leading-[1.45] tracking-tight text-[#203a3d] sm:text-[38px]">
                متغيران فقط.
                <br />ولا قيمة سرية هنا.
              </h2>
              <p className="mt-4 max-w-[390px] text-sm leading-7 text-[#66766f]">
                يحتاج العامل إلى رمز البوت ومعرّف حساب الإدارة ليعرف من يستقبل الرسائل. أضف القيم في إعدادات البيئة لدى مزوّد الاستضافة، ولا تكتبها في الشيفرة أو هذه الصفحة.
              </p>
              <div className="mt-6 flex gap-3 rounded-xl border border-[#d7dfd2] bg-[#e9eee5] p-4">
                <ShieldCheck className="mt-0.5 shrink-0 text-[#50745d]" size={19} />
                <p className="text-xs leading-6 text-[#4c6457]">تعامل مع <bdi className="mono font-semibold">BOT_TOKEN</bdi> ككلمة مرور. إذا ظهر في سجل أو مشاركة، ألغِه من BotFather وأنشئ رمزاً جديداً.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#dedbcf] bg-[#faf8f1] p-5 sm:p-7">
              <div className="mb-2 flex items-center justify-between border-b border-[#dcd9cd] pb-4">
                <div>
                  <p className="text-sm font-bold text-[#314943]">متغيرات بيئة العامل</p>
                  <p className="mt-1 text-xs text-[#7a8780]">انسخ اسم المتغير فقط، وأدخل قيمته في منصة النشر.</p>
                </div>
                <span className="rounded-md bg-[#e9eee5] px-2.5 py-1 font-mono text-[10px] text-[#54705b]">ENV</span>
              </div>
              <VariableRow
                name="BOT_TOKEN"
                description="رمز البوت الذي تنشئه عبر BotFather. خزّنه كـ Secret في منصة العامل."
                onCopy={copyVariable}
                copied={copiedVariable === 'BOT_TOKEN'}
              />
              <VariableRow
                name="ADMIN_ID"
                description="المعرّف الرقمي لحساب تيليجرام الذي يستقبل الرسائل ويرد عليها."
                onCopy={copyVariable}
                copied={copiedVariable === 'ADMIN_ID'}
              />
              <div className="mt-4 rounded-xl bg-[#f0eee5] px-4 py-3.5">
                <p className="text-xs font-bold text-[#435c52]">من أين تحصل عليهما؟</p>
                <ol className="mt-2 space-y-1.5 text-xs leading-6 text-[#687770]">
                  <li><span className="mono ml-1 text-[#35554a]">BOT_TOKEN</span> — أنشئ بوتاً عبر <bdi className="mono">BotFather</bdi>، ثم احفظ الرمز في مخزن الأسرار.</li>
                  <li><span className="mono ml-1 text-[#35554a]">ADMIN_ID</span> — استخرج المعرّف الرقمي لحساب المشرف من أداة موثوقة داخل تيليجرام، وتحقق من الرقم قبل النشر.</li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section id="flow" className="mt-20 scroll-mt-28">
          <div className="mb-8 max-w-[660px]">
            <SectionLabel>٠٢ — من يرسل إلى من؟</SectionLabel>
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#203a3d] sm:text-[38px]">خيط الرسالة لا ينقطع عند الرد.</h2>
            <p className="mt-4 text-sm leading-7 text-[#66766f]">يعمل البوت كوسيط: يسلّم رسالة المستخدم إلى الإدارة، ثم يعيد ردّ الإدارة إلى المحادثة الأصلية. الربط بين الرسالتين هو ما يمنع الرد من الوصول إلى شخص آخر.</p>
          </div>

          <div className="rounded-[22px] border border-[#dedbcf] bg-[#faf8f1] p-5 sm:p-8">
            <div className="grid gap-5 md:grid-cols-[1fr_44px_1fr_44px_1fr] md:items-center">
              <article className="min-h-[172px] rounded-xl border border-[#dcd9cd] bg-[#f5f2e9] p-5">
                <span className="mono text-[10px] font-semibold tracking-wider text-[#89938a]">01 / INBOX</span>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e1e9df] text-[#496a55]"><MessageCircle size={19} /></span>
                  <div><h3 className="text-sm font-bold">المستخدم يكتب للبوت</h3><p className="mt-1 text-xs text-[#758179]">رسالة خاصة في تيليجرام</p></div>
                </div>
                <p className="mt-4 text-xs leading-6 text-[#66766f]">تصل الرسالة إلى نقطة استقبال العامل، ومعها معرّف المحادثة الأصلي.</p>
              </article>

              <div className="hidden items-center justify-center md:flex"><span className="flow-line h-px w-full" /></div>
              <div className="flex justify-center md:hidden"><span className="h-6 w-px border-r border-dashed border-[#87a58e]" /></div>

              <article className="min-h-[172px] rounded-xl border border-[#dcd9cd] bg-[#f5f2e9] p-5">
                <span className="mono text-[10px] font-semibold tracking-wider text-[#89938a]">02 / RELAY</span>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9e2d3] text-[#806b44]"><Server size={19} /></span>
                  <div><h3 className="text-sm font-bold">العامل يمرّر السياق</h3><p className="mt-1 text-xs text-[#758179]">إلى حساب المشرف المحدد</p></div>
                </div>
                <p className="mt-4 text-xs leading-6 text-[#66766f]">يتلقى المشرف الرسالة مع مرجع يربطها بمحادثة صاحبها.</p>
              </article>

              <div className="hidden items-center justify-center md:flex"><span className="flow-line h-px w-full" /></div>
              <div className="flex justify-center md:hidden"><span className="h-6 w-px border-r border-dashed border-[#87a58e]" /></div>

              <article className="min-h-[172px] rounded-xl border border-[#a9bdab] bg-[#e8eee5] p-5">
                <span className="mono text-[10px] font-semibold tracking-wider text-[#718777]">03 / REPLY</span>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d3e1d1] text-[#43614b]"><ArrowUpLeft size={19} /></span>
                  <div><h3 className="text-sm font-bold">الرد يعود لصاحبه</h3><p className="mt-1 text-xs text-[#758179]">بالرد على الرسالة المُحوّلة</p></div>
                </div>
                <p className="mt-4 text-xs leading-6 text-[#536c59]">يربط البوت ردّ المشرف بالمرجع الأصلي، ثم يرسله إلى المستخدم المقصود.</p>
              </article>
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-[#dedbcf] pt-5 sm:flex-row sm:items-start">
              <span className="shrink-0 rounded-md bg-[#f0e8d8] px-2.5 py-1 text-[10px] font-bold text-[#816b42]">مهم</span>
              <p className="text-xs leading-6 text-[#697770]">حتى يعمل هذا النمط، يجب أن يتيح تنفيذ البوت للمشرف الرد على الرسالة التي وصلته، وأن يحتفظ العامل بمرجع المحادثة اللازمة للتوجيه. لا ترد برسالة جديدة خارج سياق المحادثة ما لم يكن التنفيذ يدعم ذلك صراحةً.</p>
            </div>
          </div>
        </section>

        <section id="deploy" className="mt-20 scroll-mt-28">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div>
              <SectionLabel>٠٣ — النشر والتشغيل</SectionLabel>
              <h2 className="text-3xl font-bold leading-[1.45] tracking-tight text-[#203a3d] sm:text-[38px]">عامل سحابي، لا جهاز دائم التشغيل.</h2>
              <p className="mt-4 text-sm leading-7 text-[#66766f]">انشر خدمة البوت كعامل أو وظيفة سحابية تدعم استقبال تحديثات تيليجرام. أسماء القوائم تختلف بين المنصات، لكن ترتيب العمل واحد.</p>
              <div className="mt-7 rounded-xl border border-[#d7dfd2] bg-[#e9eee5] p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#40594a]"><Cloud size={17} /> اختر طريقة الاستقبال</div>
                <p className="mt-2 text-xs leading-6 text-[#617266]"><bdi className="mono">Webhook</bdi> يحتاج عنوان HTTPS عامًا ومساراً يستقبل تحديثات تيليجرام. أما <bdi className="mono">Polling</bdi> فيحتاج عملية مستمرة تسحب التحديثات. استخدم الطريقة التي يدعمها تنفيذك ومنصة الاستضافة، ولا تشغّلهما معاً للبوت نفسه.</p>
              </div>
            </div>

            <div className="steps-list space-y-0">
              <article className="guide-step relative border-r border-[#bdc9bc] pb-7 pr-12">
                <span className="absolute right-[-17px] top-0 flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#b9c8b9] bg-[#f5f3eb] text-[10px] font-semibold text-[#55715e]" />
                <h3 className="text-sm font-bold text-[#344d44]">أنشئ خدمة العامل</h3>
                <p className="mt-1 text-xs leading-6 text-[#6d7a73]">اربط المستودع أو ارفع التطبيق وفق متطلبات التشغيل في مشروعك، ثم حدّد أمر البناء والتشغيل المناسبين له.</p>
              </article>
              <article className="guide-step relative border-r border-[#bdc9bc] pb-7 pr-12">
                <span className="absolute right-[-17px] top-0 flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#b9c8b9] bg-[#f5f3eb] text-[10px] font-semibold text-[#55715e]" />
                <h3 className="text-sm font-bold text-[#344d44]">أضف المتغيرات كأسرار</h3>
                <p className="mt-1 text-xs leading-6 text-[#6d7a73]">أدخل <bdi className="mono">BOT_TOKEN</bdi> و <bdi className="mono">ADMIN_ID</bdi> في إعدادات البيئة السرية للخدمة، لا في ملفات الواجهة أو المستودع.</p>
              </article>
              <article className="guide-step relative border-r border-[#bdc9bc] pb-7 pr-12">
                <span className="absolute right-[-17px] top-0 flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#b9c8b9] bg-[#f5f3eb] text-[10px] font-semibold text-[#55715e]" />
                <h3 className="text-sm font-bold text-[#344d44]">اضبط طريقة الاستقبال</h3>
                <p className="mt-1 text-xs leading-6 text-[#6d7a73]">في وضع Webhook، سجّل عنوان HTTPS الذي توفّره الخدمة في إعداد البوت. في وضع Polling، تأكد أن العامل يعمل باستمرار ولا توجد نسخة ثانية تسحب التحديثات.</p>
              </article>
              <article className="guide-step relative pr-12">
                <span className="absolute right-[-17px] top-0 flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#a9bdab] bg-[#e5ede3] text-[10px] font-semibold text-[#55715e]" />
                <h3 className="text-sm font-bold text-[#344d44]">انشر ثم اختبر المسار كاملاً</h3>
                <p className="mt-1 text-xs leading-6 text-[#6d7a73]">أرسل رسالة اختبار من حساب مستخدم، تحقق من وصولها إلى المشرف، ثم استخدم الرد على الرسالة المُحوّلة. تأكد أن الإجابة وصلت إلى الحساب الذي أرسل الاختبار.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-2xl bg-[#203a3d] p-6 text-[#f5f2e9] sm:p-8">
              <SectionLabel>قبل اعتبار الإعداد مكتملاً</SectionLabel>
              <h2 className="text-2xl font-bold tracking-tight">قائمة فحص قصيرة، واختبار حقيقي.</h2>
              <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {[
                  'المتغيران محفوظان في مخزن أسرار المنصة',
                  'معرّف الإدارة يعود إلى الحساب الصحيح',
                  'العامل يستقبل تحديثات تيليجرام',
                  'الرد على الرسالة الممرّرة يعود للمستخدم نفسه',
                ].map((item, index) => (
                  <div key={item} className="flex items-start gap-3 text-xs leading-6 text-[#d5e0d2]" data-testid={`text-check-${index + 1}`}>
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#90b398]/60 text-[#b7d0bb]"><Check size={10} /></span>
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-6 border-t border-white/15 pt-4 text-[11px] leading-6 text-[#b8c9bd]">هذه القائمة خطوات تحقق يدوية؛ لا تعرض الصفحة حالة الخدمة أو نتيجة اتصال فعلية.</p>
            </div>

            <aside className="rounded-2xl border border-[#dedbcf] bg-[#faf8f1] p-6 sm:p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0e8d8] text-[#806b44]"><CircleHelp size={19} /></div>
              <h3 className="mt-5 text-lg font-bold text-[#344d44]">إذا لم تصل الرسالة</h3>
              <ul className="mt-3 space-y-2 text-xs leading-6 text-[#6d7a73]">
                <li>راجع سجلات العامل بحثاً عن أخطاء استقبال التحديثات، من دون طباعة قيمة الرمز.</li>
                <li>تحقق أن <bdi className="mono">ADMIN_ID</bdi> رقمي ويخص حساب المشرف المقصود.</li>
                <li>تأكد من طريقة استقبال واحدة فقط، ومن صحة عنوان Webhook إن كنت تستخدمه.</li>
                <li>جرّب الرد على الرسالة التي أرسلها البوت إلى المشرف، لا على محادثة أخرى.</li>
              </ul>
            </aside>
          </div>
        </section>

        <section className="mt-20 border-t border-[#dcd9cd] pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionLabel>مرجع سريع</SectionLabel>
              <h2 className="text-xl font-bold text-[#203a3d]">ثلاث قواعد تحفظ مسار الدعم.</h2>
            </div>
            <a href="#top" className="inline-flex items-center gap-2 text-xs font-semibold text-[#486b58] hover:text-[#203a3d]" data-testid="link-back-to-top">
              العودة إلى البداية <ArrowUpLeft size={14} />
            </a>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#dedbcf] bg-[#f8f6ef] p-4">
              <LockKeyhole size={17} className="text-[#5b7a63]" />
              <h3 className="mt-3 text-sm font-bold">لا تضع الرمز في الواجهة</h3>
              <p className="mt-1 text-xs leading-6 text-[#718078]">الأسرار مكانها إعدادات بيئة العامل فقط، لا ملفات الموقع ولا السجلات.</p>
            </div>
            <div className="rounded-xl border border-[#dedbcf] bg-[#f8f6ef] p-4">
              <MessageSquareText size={17} className="text-[#8b744a]" />
              <h3 className="mt-3 text-sm font-bold">حافظ على مرجع المحادثة</h3>
              <p className="mt-1 text-xs leading-6 text-[#718078]">الرد على الرسالة المُحوّلة هو ما يربط الإجابة بالشخص المناسب.</p>
            </div>
            <div className="rounded-xl border border-[#dedbcf] bg-[#f8f6ef] p-4">
              <Terminal size={17} className="text-[#55717a]" />
              <h3 className="mt-3 text-sm font-bold">اختبر بعد كل نشر</h3>
              <p className="mt-1 text-xs leading-6 text-[#718078]">رسالة واردة وردّ عائد — الاختبار الكامل أفضل من افتراض أن العامل يعمل.</p>
            </div>
          </div>
        </section>

        <footer className="mt-12 flex flex-col gap-3 border-t border-[#dcd9cd] pt-5 text-[11px] leading-6 text-[#7d8981] sm:flex-row sm:items-center sm:justify-between">
          <p>مِرساة — دليل تشغيل ثابت لوسيط دعم تيليجرام.</p>
          <p className="flex items-center gap-2"><ShieldCheck size={14} /> لا يجمع هذا الدليل بيانات ولا يتصل ببوتك.</p>
        </footer>
      </div>

      {copyMessage && (
        <div role="status" className="fixed bottom-5 left-5 z-30 rounded-xl bg-[#203a3d] px-4 py-3 text-xs font-medium text-[#f5f2e9] shadow-lg" data-testid="status-copy">
          {copyMessage}
        </div>
      )}
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
