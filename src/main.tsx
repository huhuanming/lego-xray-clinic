import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BadgeCheck,
  Bone,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  Hospital,
  Home,
  MapPinned,
  Pill,
  Printer,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trophy,
  UserRound,
  Volume2,
} from 'lucide-react';
import './styles.css';
import { clinicApi, type ApiPatient, type FollowUpRecord, type HistoryResponse } from './api';
import { preparePatientPhoto } from './photo';

type BodyPart = '全身' | '头部' | '胸部' | '肚子' | '腿部';
type Symptom = '没精神' | '肚子痛' | '走路咔嗒响' | '头晕晕' | '笑不出来' | '骨头松松的' | '外壳擦伤' | '肚肚咕噜' | '身体热热的';
type DepartmentId = 'xray' | 'orthopedics' | 'internal' | 'heart' | 'gastro' | 'surgery' | 'dental' | 'pharmacy';

type Patient = {
  id: string;
  name: string;
  age: string;
  symptoms: Symptom[];
  photoUrl: string;
  photoBackground: string;
  totalStickers: number;
  visitCount: number;
  pendingFollowUps: number;
  lastVisitAt: string | null;
};

type DepartmentResult = {
  id: DepartmentId;
  name: string;
  icon: string;
  score: number;
  summary: string;
  sticker: string;
  detail: string;
  diagnosisEmoji?: string;
  findings?: Array<{ icon: string; label: string; value: string }>;
  prescription?: Array<{ icon: string; text: string; targetCount: number }>;
  drawPrompt?: string;
  seed?: number;
};

type JourneyState = {
  patient: Patient;
  registered: boolean;
  results: DepartmentResult[];
  journeyToken: string;
  startedAt: string;
  plannedRoute?: DepartmentId[];
  archivedVisitId?: string;
};

type Report = {
  id: string;
  time: string;
  doctor: string;
  score: number;
  diagnosis: string;
  diagnosisEmoji: string;
  diagnosisCode: string;
  summary: string;
  findings: Array<{ icon: string; title: string; value: string; status: 'good' | 'watch'; detail: string }>;
  prescription: Array<{ icon: string; label: string; text: string }>;
  care: Array<{ icon: string; text: string }>;
  followUp: string;
  sticker: string;
};

const bodyParts: BodyPart[] = ['全身', '头部', '胸部', '肚子', '腿部'];
const symptoms: Symptom[] = ['没精神', '肚子痛', '走路咔嗒响', '头晕晕', '笑不出来', '骨头松松的', '外壳擦伤', '肚肚咕噜', '身体热热的'];

const bodyPartIcons: Record<BodyPart, string> = {
  全身: '🧍',
  头部: '🙂',
  胸部: '💛',
  肚子: '🫃',
  腿部: '🦵',
};

const symptomIcons: Record<Symptom, string> = {
  没精神: '😴',
  肚子痛: '😣',
  走路咔嗒响: '🦿',
  头晕晕: '😵‍💫',
  笑不出来: '☹️',
  骨头松松的: '🦴',
  外壳擦伤: '🩹',
  肚肚咕噜: '🫧',
  身体热热的: '🌡️',
};

function patientFromApi(patient: ApiPatient, symptoms: Symptom[] = []): Patient {
  return {
    id: patient.id,
    name: patient.name,
    age: patient.age,
    symptoms,
    photoUrl: patient.photoUrl || '',
    photoBackground: patient.photoBackground || 'rainbow',
    totalStickers: patient.totalStickers || 0,
    visitCount: patient.visitCount || 0,
    pendingFollowUps: patient.pendingFollowUps || 0,
    lastVisitAt: patient.lastVisitAt,
  };
}

function emptyPatient(): Patient {
  return { id: '', name: '', age: '6', symptoms: ['没精神'], photoUrl: '', photoBackground: 'rainbow', totalStickers: 0, visitCount: 0, pendingFollowUps: 0, lastVisitAt: null };
}

function createJourney(patient: Patient): JourneyState {
  return { patient, registered: true, results: [], journeyToken: crypto.randomUUID(), startedAt: new Date().toISOString() };
}

function PatientAvatar({ patient, size = 'medium', photoDataUrl = '' }: { patient: Patient; size?: 'small' | 'medium' | 'large'; photoDataUrl?: string }) {
  const source = photoDataUrl || patient.photoUrl;
  return (
    <div className={`patient-photo patient-photo-${size} photo-bg-${patient.photoBackground || 'rainbow'}`}>
      {source ? <img src={source} alt={`${patient.name || '积木小患者'}的病历照片`}/> : <span>🧑‍🚀</span>}
      <i>✦</i>
    </div>
  );
}

const energyTypes = [
  { name: '彩虹能量', icon: '🌈', particle: '七彩光点' },
  { name: '勇气核心', icon: '🦸', particle: '金色勇气粒子' },
  { name: '星星电力', icon: '⭐', particle: '闪闪星屑' },
  { name: '月亮梦力', icon: '🌙', particle: '银色梦泡泡' },
  { name: '笑容能量', icon: '😄', particle: '咯咯笑声' },
  { name: '拥抱电量', icon: '🤗', particle: '暖暖抱抱光' },
  { name: '闪电动力', icon: '⚡', particle: '蓝色小闪电' },
  { name: '泡泡动力', icon: '🫧', particle: '透明小泡泡' },
  { name: '饼干动力', icon: '🍪', particle: '香香饼干屑' },
  { name: '想象力', icon: '💡', particle: '好点子火花' },
] as const;

const conditionTypes = [
  { name: '电量不足症', description: '储备只剩下三小格，暂时进入慢动作省电模式', scan: '亮度比标准值低了一点' },
  { name: '轻微过热症', description: '刚才工作得太认真，温度悄悄升高了一小格', scan: '发现几颗暖橙色光点' },
  { name: '快乐打结症', description: '几颗快乐粒子缠在一起，需要轻轻伸展才能松开', scan: '能量线出现可爱的小蝴蝶结' },
  { name: '能量堵车症', description: '小小能量车排成了队，所以前进速度有一点慢', scan: '能量通道出现短短的排队现象' },
  { name: '齿轮偷懒症', description: '里面有一颗齿轮想多睡五分钟，转动速度暂时变慢', scan: '咔嗒频率比平常少了两声' },
  { name: '粒子迷路症', description: '几颗调皮粒子走错了方向，正在等待医生带路', scan: '发现三颗反方向移动的小光点' },
  { name: '咔嗒响亮症', description: '关节发出的咔嗒声有点大，但所有积木都连接完整', scan: '关节声音指数稍微升高' },
  { name: '轻轻摇晃症', description: '连接处有一点点摇晃，需要在柔软基地好好休息', scan: '稳定度下降了一小格' },
  { name: '充电慢慢症', description: '充电入口正在打哈欠，所以恢复速度比平常慢一点', scan: '充电速度暂时进入小乌龟档' },
  { name: '亮度下降症', description: '今天的光芒稍微变暗了，补充快乐后就会重新闪亮', scan: '核心光圈少亮了一层' },
] as const;

const causeTypes = [
  { name: '火箭降落型', icon: '🚀', story: '刚完成了一次很颠簸的火箭降落', rest: '今天暂停火箭发射和月球跳跃' },
  { name: '超级英雄型', icon: '🦸', story: '今天帮助了太多需要帮助的小伙伴', rest: '把披风挂好，让英雄基地安静十分钟' },
  { name: '恐龙追逐型', icon: '🦖', story: '刚才跑得太快，躲过了一只想象中的大恐龙', rest: '今天不再参加恐龙追逐比赛' },
  { name: '积木舞会型', icon: '💃', story: '在积木舞会上连续转了好多圈', rest: '暂停旋转舞步，改成慢慢点头舞' },
  { name: '故事装满型', icon: '📚', story: '脑袋里一下装进了太多精彩故事', rest: '一次只听一个故事，让好点子排队' },
  { name: '饼干香味型', icon: '🍪', story: '被空气里的想象饼干香味分散了注意力', rest: '远离想象饼干罐，先喝一小杯水' },
  { name: '怪兽惊吓型', icon: '👾', story: '被一只其实很友好的小怪兽吓了一跳', rest: '告诉小怪兽“我们是朋友”，再深呼吸' },
  { name: '彩虹滑梯型', icon: '🛝', story: '在彩虹滑梯上来来回回玩了好多次', rest: '彩虹滑梯今天休息，改玩安静拼搭' },
  { name: '睡觉翻滚型', icon: '🛌', story: '昨晚睡觉时像小陀螺一样滚来滚去', rest: '今晚盖好小毯子，在枕头基地充电' },
  { name: '泡泡派对型', icon: '🫧', story: '参加泡泡派对时吸进了几颗调皮泡泡', rest: '暂停泡泡派对，慢慢把泡泡呼出去' },
] as const;

const treatmentPools = [
  {
    label: '马上照顾',
    options: [
      ['🤗', '获得 3 个彩虹拥抱，每个持续 5 秒'], ['🫶', '把小人捧在手心，轻声说“你很安全”'],
      ['🌬️', '一起做 3 次慢慢的魔法深呼吸'], ['🛋️', '在柔软基地安静坐 10 分钟'],
      ['🧸', '请毛绒玩具护士陪伴一会儿'], ['👐', '轻轻拍拍肩膀和小手各 3 次'],
      ['🎵', '听一首安静的小歌，让心跳慢下来'], ['💤', '闭眼休息 5 分钟，不执行任务'],
      ['💬', '把不舒服的感觉告诉方块医生'], ['☁️', '躺在想象云朵上数 10 只小羊'],
    ],
  },
  {
    label: '能量补给',
    options: [
      ['🥤', '补充 2 小杯温水或想象果汁'], ['🍎', '吃一份苹果形状的彩虹能量餐'],
      ['🍌', '补充一根月亮香蕉，恢复弯弯笑容'], ['🥛', '喝一小杯勇气牛奶，慢慢补充电量'],
      ['🍓', '获得 3 颗草莓能量粒子'], ['🥕', '嚼一嚼胡萝卜，让眼睛更有精神'],
      ['🍲', '喝一碗暖暖的想象星星汤'], ['🍞', '吃一小片云朵面包，不要太着急'],
      ['🍇', '数着吃 5 颗葡萄小电池'], ['🌽', '补充一根金色玉米能量棒'],
    ],
  },
  {
    label: '身体修复',
    options: [
      ['🙆', '做一次轻柔的积木伸展操'], ['🦵', '左右小腿各休息 5 分钟'],
      ['🧘', '保持山峰姿势，安静数到 10'], ['👐', '请家长做一次轻轻的关节检查'],
      ['🛏️', '平躺在修理床上，让齿轮自动归位'], ['🐢', '用小乌龟速度慢慢走 10 步'],
      ['🪽', '像小鸟一样轻轻展开手臂 3 次'], ['🧍', '站直、放松，再晃晃小手小脚'],
      ['🧩', '拼一块简单积木，让手指慢慢活动'], ['🧦', '给双脚穿上想象中的软云袜'],
    ],
  },
  {
    label: '快乐疗法',
    options: [
      ['📖', '听一个短短的睡前故事'], ['😂', '听一个能让人咯咯笑的小笑话'],
      ['🎨', '画一张彩虹处方送给自己'], ['🎶', '哼一段最喜欢的快乐歌曲'],
      ['🐣', '学小鸡走路 5 步，再坐下休息'], ['🪄', '说三遍魔法词“咔嗒咔嗒好起来”'],
      ['💃', '跳一段不转圈的慢慢舞'], ['👑', '戴上勇气王冠拍一张纪念照'],
      ['🫧', '想象吹出 3 个烦恼泡泡'], ['🌟', '说出今天做得最棒的一件事'],
    ],
  },
  {
    label: '房间护理',
    options: [
      ['🪟', '打开想象窗户，让新鲜空气进来'], ['🛋️', '在沙发基地铺好柔软小毯子'],
      ['🌤️', '去有阳光的地方晒 5 分钟能量'], ['💡', '把房间灯光调成温柔月亮模式'],
      ['🔇', '启动安静模式，暂停响亮的玩具'], ['🧹', '清理周围散落积木，留出休息位置'],
      ['🌱', '看看绿色小植物，让眼睛休息'], ['🧸', '安排一个玩具朋友轮流陪护'],
      ['🛏️', '整理枕头基地，准备舒服充电'], ['🎐', '听一会儿轻轻的风声和铃声'],
    ],
  },
  {
    label: '恢复任务',
    options: [
      ['✅', '能连续笑 3 次，就完成恢复任务'], ['👣', '慢慢走 10 步，没有咔嗒响就过关'],
      ['😄', '收集家人的 3 个笑脸作为能量'], ['💛', '说出 2 件勇敢的事情，点亮核心'],
      ['⭐', '找到房间里的 5 个星星形状'], ['🧱', '完成一个不超过 6 块的简单拼搭'],
      ['🔢', '从 1 数到 10，检查呼吸是否平稳'], ['🎯', '把小纸球轻轻投进盒子 3 次'],
      ['🌈', '找齐红黄蓝 3 种颜色就算康复'], ['🔔', '休息结束后说“叮”，通知医生复查'],
    ],
  },
] as const;

const extraCare = [
  ['🧼', '保持积木连接处干净，不要碰到真正的水'], ['🛑', '今天暂停火山、跳跃和高速救援任务'],
  ['🌙', '今晚早点回到枕头基地充电'], ['👀', '每隔一会儿请家长看看小人恢复得怎么样'],
  ['🧸', '让玩具护士陪在旁边，避免一个人担心'], ['🧱', '暂时只玩简单拼搭，不挑战超高建筑'],
  ['🔉', '把响亮声音调小，让能量核心安静工作'], ['☀️', '白天晒一点温柔阳光，晚上早点休息'],
  ['💬', '如果还不舒服，要马上告诉家长'], ['🏥', '下一个游戏日再来积木医院复查'],
] as const;

const doctors = ['咔嗒主任', '方块医生', '彩虹医师', '小齿轮教授', '泡泡医生', '星星护士长', '月亮博士', '勇气医师'];
const stickers = ['勇敢小患者', '超级配合奖', 'X光探险家', '今天也很坚强', '彩虹恢复之星', '安静休息冠军', '快乐能量达人', '最佳小英雄'];
const DIAGNOSIS_COUNT = energyTypes.length * conditionTypes.length * causeTypes.length;

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function choose<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function makeReport(name: string, part: BodyPart, selectedSymptoms: Symptom[], forcedSeed?: number): Report {
  const seed = forcedSeed ?? (Date.now() ^ Math.floor(performance.now() * 1000) ^ name.length * 7919 ^ selectedSymptoms.length * 104729);
  const random = createRandom(seed);
  const energyIndex = Math.floor(random() * energyTypes.length);
  const conditionIndex = Math.floor(random() * conditionTypes.length);
  const causeIndex = Math.floor(random() * causeTypes.length);
  const energy = energyTypes[energyIndex];
  const condition = conditionTypes[conditionIndex];
  const cause = causeTypes[causeIndex];
  const caseNumber = causeIndex * 100 + energyIndex * 10 + conditionIndex + 1;
  const score = 80 + Math.floor(random() * 19);
  const issueArea = part === '全身' ? '能量核心' : part;
  const mainSymptom = selectedSymptoms.length ? choose(selectedSymptoms, random) : '没精神';
  const prescription = treatmentPools.map((pool) => {
    const option = choose(pool.options as readonly (readonly [string, string])[], random);
    return { icon: option[0], label: pool.label, text: option[1] };
  });
  const careChoices = [...extraCare].sort(() => random() - .5).slice(0, 2);
  return {
    id: `XR-${new Date().getFullYear()}-${String(Math.abs(seed)).slice(-6).padStart(6, '0')}`,
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
    doctor: choose(doctors, random),
    score,
    diagnosis: `${cause.name} · ${energy.name}${condition.name}`,
    diagnosisEmoji: energy.icon,
    diagnosisCode: `FUN-${String(caseNumber).padStart(4, '0')} / ${DIAGNOSIS_COUNT}`,
    summary: `${cause.story}，让${issueArea}里的${energy.particle}${condition.description}。主要表现是“${mainSymptom}”，休息和快乐治疗后就会恢复。`,
    findings: [
      {
        icon: '🦴',
        title: '积木骨架完整度',
        value: `${96 + Math.floor(random() * 4)}%`,
        status: 'good',
        detail: '头、身体与四肢连接整齐，没有发现缺失积木。',
      },
      {
        icon: energy.icon,
        title: `${energy.name}活跃度`,
        value: `${61 + Math.floor(random() * 19)}%`,
        status: 'watch',
        detail: `在${issueArea}${condition.scan}，符合“${cause.name}”特征。`,
      },
      {
        icon: '💛',
        title: '勇气核心亮度',
        value: `${score}%`,
        status: 'good',
        detail: `面对扫描仪很勇敢，${cause.icon}造成的小波动正在慢慢消失。`,
      },
      {
        icon: '😄',
        title: '笑容能量储备',
        value: `${76 + Math.floor(random() * 23)}%`,
        status: score > 90 ? 'good' : 'watch',
        detail: `储备仍然足够，完成“${prescription[3].label}”后会更快回满。`,
      },
    ],
    prescription,
    care: [
      { icon: cause.icon, text: cause.rest },
      ...careChoices.map(([icon, text]) => ({ icon, text })),
    ],
    followUp: `${1 + Math.floor(random() * 3)} 个游戏日后复查，完成“${prescription[5].text}”即可申请出院`,
    sticker: choose(stickers, random),
  };
}

function MinifigureXray({ scanning, bodyPart }: { scanning: boolean; bodyPart: BodyPart }) {
  return (
    <div className={`xray-stage ${scanning ? 'is-scanning' : ''}`} aria-label="积木小人X光影像">
      <div className="xray-grid" />
      <div className="figure-wrap">
        <svg className="minifigure" viewBox="0 0 240 380" role="img" aria-label="积木小人的X光骨架">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="bodyGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#d5ffff" stopOpacity=".82" />
              <stop offset="1" stopColor="#50e6ff" stopOpacity=".22" />
            </linearGradient>
          </defs>
          <g className="shell" fill="url(#bodyGlow)" stroke="#bffcff" strokeWidth="3">
            <path d="M75 46 Q75 12 120 12 Q165 12 165 46 L158 100 Q153 120 120 120 Q87 120 82 100Z" />
            <path d="M76 132 L164 132 L184 242 L56 242Z" />
            <path d="M62 142 L30 154 L12 252 Q10 268 29 272 L45 264 L72 176Z" />
            <path d="M178 142 L210 154 L228 252 Q230 268 211 272 L195 264 L168 176Z" />
            <path d="M64 250 L116 250 L108 356 Q106 370 88 370 L55 370 Q42 368 46 352Z" />
            <path d="M124 250 L176 250 L194 352 Q198 368 185 370 L152 370 Q134 370 132 356Z" />
          </g>
          <g className="bones" fill="none" stroke="#edffff" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)">
            <circle cx="120" cy="68" r="34" strokeWidth="6" />
            <path d="M98 82 Q120 96 142 82 M105 59 L113 59 M127 59 L135 59" strokeWidth="4" />
            <path d="M120 105 L120 224 M88 144 Q120 126 152 144 M82 164 Q120 145 158 164 M80 186 Q120 166 160 186 M87 208 Q120 190 153 208" strokeWidth="6" />
            <path d="M78 153 L36 183 L26 247 M162 153 L204 183 L214 247" strokeWidth="8" />
            <path d="M80 238 Q120 214 160 238 M92 246 L73 338 M148 246 L167 338" strokeWidth="9" />
            <circle cx="29" cy="258" r="12" strokeWidth="5" /><circle cx="211" cy="258" r="12" strokeWidth="5" />
          </g>
          <g className="core" filter="url(#glow)">
            <path d="M120 177 C103 157 84 177 92 195 C99 210 120 220 120 220 C120 220 141 210 148 195 C156 177 137 157 120 177Z" fill="#ffc42d" />
          </g>
        </svg>
      </div>
      <div className={`target target-${bodyPart}`}><span>{bodyPart}</span></div>
      <div className="scan-beam" />
      <div className="orientation">R</div>
      <div className="xray-meta xray-meta-top">KID-SCAN / AP VIEW</div>
      <div className="xray-meta xray-meta-bottom">MAGNETIC TILE IMAGING</div>
      <div className="vitals-line"><span /><span /><span /><span /><span /></div>
    </div>
  );
}

function XRayDepartment({
  patient,
  onBack,
  onComplete,
}: {
  patient: Patient;
  onBack: () => void;
  onComplete: (result: DepartmentResult, patient: Patient) => void;
}) {
  const [name, setName] = useState(patient.name);
  const [age, setAge] = useState(patient.age);
  const [bodyPart, setBodyPart] = useState<BodyPart>('全身');
  const [selectedSymptoms, setSelectedSymptoms] = useState<Symptom[]>(patient.symptoms.length ? patient.symptoms : ['没精神']);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<Report | null>(() => {
    const isPrintPreview = new URLSearchParams(window.location.search).get('mode') === 'print-preview';
    return isPrintPreview ? makeReport('小闪电', '全身', ['没精神']) : null;
  });
  const resultRef = useRef<HTMLDivElement>(null);

  const phase = useMemo(() => {
    if (progress < 18) return '🧲 正在连接磁力片扫描舱…';
    if (progress < 42) return '🦴 正在寻找积木骨架…';
    if (progress < 68) return `${bodyPartIcons[bodyPart]} 正在检查${bodyPart}…`;
    if (progress < 91) return '🌈 正在检查彩虹能量…';
    return '👩‍⚕️ 正在请方块医生看报告…';
  }, [progress, bodyPart]);

  useEffect(() => {
    if (!scanning) return;
    const timer = window.setInterval(() => {
      setProgress((p) => Math.min(100, p + 2));
    }, 85);
    return () => window.clearInterval(timer);
  }, [scanning]);

  useEffect(() => {
    if (!scanning || progress < 100) return;
    const done = window.setTimeout(() => {
      setScanning(false);
      setReport(makeReport(name.trim() || '神秘小人', bodyPart, selectedSymptoms));
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }, 450);
    return () => window.clearTimeout(done);
  }, [progress, scanning, name, bodyPart, selectedSymptoms]);

  const toggleSymptom = (symptom: Symptom) => {
    setSelectedSymptoms((current) => current.includes(symptom)
      ? current.filter((item) => item !== symptom)
      : [...current, symptom]);
  };

  const startScan = () => {
    setReport(null);
    setProgress(0);
    setScanning(true);
  };

  const finishDepartment = () => {
    if (!report) return;
    onComplete({
      id: 'xray',
      name: 'X 光室',
      icon: '🩻',
      score: report.score,
      summary: report.diagnosis,
      detail: report.summary,
      sticker: report.sticker,
      diagnosisEmoji: report.diagnosisEmoji,
      findings: report.findings.slice(0, 3).map((item) => ({ icon: item.icon, label: item.title, value: item.value })),
      prescription: report.prescription.slice(0, 3).map((item, index) => ({ icon: item.icon, text: item.text, targetCount: [3, 5, 7][index] })),
      drawPrompt: '画出你在 X 光片里看到的超级积木骨架',
    }, { ...patient, name: name.trim() || patient.name, age: age || patient.age, symptoms: selectedSymptoms });
  };

  return (
    <main className="app-shell">
      <HospitalHeader room="X 光室 · 03" color="#24cfc6" onBack={onBack}/>

      <section className="intro">
        <div>
          <div className="eyebrow"><Sparkles size={15} /> 儿童角色扮演检查系统</div>
          <h1>积木小人<br/><em>X 光工作站</em></h1>
        </div>
        <p>给小人选一选哪里不舒服，再按黄色按钮，X 光机就会告诉你答案！</p>
      </section>

      <section className="workstation">
        <aside className="control-panel">
          <div className="panel-heading"><span>01</span><div><h2>患者登记</h2><p>PATIENT CHECK-IN</p></div></div>
          <label className="field-label" htmlFor="patient-name">小患者名字</label>
          <div className="input-shell"><UserRound size={18}/><input id="patient-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={12}/></div>
          <label className="field-label" htmlFor="patient-age">积木年龄</label>
          <div className="age-row">
            <div className="input-shell"><input id="patient-age" type="number" min="1" max="99" value={age} onChange={(e) => setAge(e.target.value)} /><span>岁</span></div>
            <div className="patient-type"><span>患者类型</span><b>MINI FIGURE</b></div>
          </div>

          <div className="panel-heading compact"><span>02</span><div><h2>选择检查部位</h2><p>SCAN REGION</p></div></div>
          <div className="segment-grid">
            {bodyParts.map((part) => <button key={part} className={bodyPart === part ? 'active' : ''} onClick={() => setBodyPart(part)}><span>{bodyPartIcons[part]}</span><small>{part}</small></button>)}
          </div>

          <label className="field-label symptom-label">今天哪里不舒服？<small>可多选</small></label>
          <div className="symptom-list">
            {symptoms.map((symptom) => <button key={symptom} className={selectedSymptoms.includes(symptom) ? 'active' : ''} onClick={() => toggleSymptom(symptom)}><span className="symptom-emoji">{symptomIcons[symptom]}</span><small>{symptom}</small><i>{selectedSymptoms.includes(symptom) ? '✓' : ''}</i></button>)}
          </div>

          <div className="case-library-badge">
            <span>🎲</span>
            <div><b>1000 种趣味病情</b><small>超过 1,000,000 种治疗组合</small></div>
            <i>随机</i>
          </div>

          <button className="scan-button" disabled={scanning} onClick={startScan}>
            {scanning ? <Activity size={22}/> : <ScanLine size={22}/>}<span>{scanning ? '扫描进行中' : '启动 X 光扫描'}<small>{scanning ? '请保持小人不动' : 'START KID-SCAN'}</small></span><ChevronRight size={20}/>
          </button>
        </aside>

        <section className="imaging-panel">
          <div className="imaging-head">
            <div><span className="live-dot"/> LIVE IMAGING</div>
            <div>患者：<b>{name || '未命名'}</b> · {age || '?'} 岁</div>
          </div>
          <MinifigureXray scanning={scanning} bodyPart={bodyPart}/>
          <div className="scan-status">
            <div className="status-copy">
              {scanning ? <Activity className="pulse-icon" size={19}/> : <ShieldCheck size={19}/>}
              <span><b>{scanning ? phase : report ? '扫描已完成，报告已生成' : '扫描舱准备就绪'}</b><small>{scanning ? `扫描进度 ${progress}%` : '请将积木小人放入磁力片检查舱'}</small></span>
            </div>
            <div className="progress-track"><i style={{ width: `${scanning ? progress : report ? 100 : 0}%` }}/></div>
            <b className="progress-number">{scanning ? progress : report ? 100 : 0}<small>%</small></b>
          </div>
          <div className="imaging-foot"><span><i/> 辐射剂量</span><b>0.00</b><em>纯游戏 · 无真实射线</em></div>
        </section>
      </section>

      {report && (
        <section className="report" ref={resultRef}>
          <div className="report-topline" />
          <header className="report-header">
            <div className="report-title"><div className="report-seal"><Stethoscope size={28}/></div><div><span>咔嗒咔嗒积木医院 · 影像科</span><h2>小患者检查报告</h2><p>MINI PATIENT DIAGNOSTIC REPORT</p></div></div>
            <div className="report-actions"><button onClick={() => window.print()}><Printer size={17}/> 打印报告</button><button onClick={startScan}><RotateCcw size={17}/> 再查一次</button><button className="finish-dept" onClick={finishDepartment}><BadgeCheck size={17}/> 完成检查</button></div>
          </header>
          <div className="patient-strip">
            <div><span>患者姓名</span><b>{name || '神秘小人'}</b></div>
            <div><span>积木年龄</span><b>{age || '?'} 岁</b></div>
            <div><span>检查部位</span><b>{bodyPart}</b></div>
            <div><span>病历编号</span><b>{report.id}</b></div>
            <div><span>检查时间</span><b>{report.time}</b></div>
          </div>

          <div className="report-grid">
            <div className="report-main">
              <div className="picture-story" aria-label="小朋友看图版检查结果">
                <div className="picture-story-label"><Sparkles size={15}/> 看图就懂</div>
                <article><span>{bodyPartIcons[bodyPart]}</span><p>这里不舒服</p><b>{bodyPart}</b></article>
                <i>→</i>
                <article className="orange"><span>{report.diagnosisEmoji}</span><p>发现小故障</p><b>{report.diagnosis}</b></article>
                <i>→</i>
                <article className="green"><span>{report.prescription[0].icon}{report.prescription[1].icon}</span><p>这样会变好</p><b>6 步快乐治疗</b></article>
              </div>
              <div className="diagnosis-card">
                <div className="diagnosis-icon emoji-diagnosis">{report.diagnosisEmoji}</div>
                <div><span>方块医生的诊断</span><h3>{report.diagnosis}</h3><p>{report.summary}</p><small>趣味诊断编号 · {report.diagnosisCode}</small></div>
                <div className="health-score"><strong>{report.score}</strong><span>/ 100</span><small>健康能量</small></div>
              </div>

              <div className="section-title"><Bone size={19}/><div><h3>影像检查结果</h3><p>IMAGING FINDINGS</p></div></div>
              <div className="findings">
                {report.findings.map((finding) => (
                  <article key={finding.title}>
                    <div className={`finding-status ${finding.status}`}><CheckCircle2 size={17}/></div>
                    <span className="finding-emoji">{finding.icon}</span>
                    <div><h4>{finding.title}</h4><p>{finding.detail}</p></div>
                    <b>{finding.value}</b>
                  </article>
                ))}
              </div>

              <div className="section-title"><ClipboardList size={19}/><div><h3>医生的快乐处方</h3><p>PLAYFUL PRESCRIPTION</p></div></div>
              <ol className="prescription-list">
                {report.prescription.map((item) => <li key={item.text}><span>{item.icon}</span><div><small>{item.label}</small><b>{item.text}</b></div></li>)}
              </ol>
            </div>

            <aside className="report-side">
              <div className="mini-xray"><MinifigureXray scanning={false} bodyPart={bodyPart}/><span>影像编号<br/><b>{report.id}</b></span></div>
              <div className="care-card"><h3><HeartPulse size={18}/> 回家护理小贴士</h3><ul>{report.care.map((item) => <li key={item.text}><span>{item.icon}</span>{item.text}</li>)}</ul></div>
              <div className="follow-card"><span>建议复查</span><p>{report.followUp}</p></div>
              <div className="doctor-sign"><span>主诊医生</span><strong>{report.doctor}</strong><i>CLICK-CLACK</i></div>
              <div className="award-sticker"><Sparkles size={17}/><span>{report.sticker}</span><b>★</b></div>
            </aside>
          </div>

          <footer className="report-footer"><ShieldCheck size={17}/><p><b>给大人的提醒：</b>这是亲子角色扮演游戏生成的趣味报告，不是真正的医疗检查，也不能用于诊断。真实身体不舒服时，请及时告诉家长并咨询医生。</p></footer>
        </section>
      )}

      <footer className="page-footer"><span>CLICK-CLACK CHILDREN'S CLINIC</span><p>让每一次检查，都变成勇敢的冒险。</p><b>♥</b></footer>
    </main>
  );
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = .9;
  utterance.pitch = 1.12;
  window.speechSynthesis.speak(utterance);
}

function HospitalHeader({ room, color = '#23d9d0', onBack }: { room: string; color?: string; onBack?: () => void }) {
  const floor = room.includes('出院') || room.includes('回访') ? 6
    : room.includes('牙科') || room.includes('药房') ? 5
      : room.includes('外科') || room.includes('肠胃') ? 4
        : room.includes('内科') || room.includes('心脏') ? 3
          : room.includes('X 光') || room.includes('骨科') ? 2
            : room.includes('候诊') ? 0 : 1;
  return (
    <header className="topbar hospital-topbar" style={{ '--room-color': color } as React.CSSProperties}>
      {onBack && <button className="topbar-back" onClick={onBack}><Home size={18}/><span>回医院大楼</span></button>}
      <div className="brand-mark"><Hospital size={22} strokeWidth={2.5}/></div>
      <div className="brand-copy"><strong>咔嗒咔嗒积木医院</strong><span>MAGNETIC TILE CHILDREN'S CLINIC</span></div>
      <div className="system-status"><i/> 全院系统在线</div>
      <div className="mini-building" aria-label={`当前位置：${floor ? `${floor}楼` : '候诊区'}`}>
        {[6, 5, 4, 3, 2, 1].map((level) => <i key={level} className={level === floor ? 'active' : ''}>{level}</i>)}
      </div>
      <div className="room-label"><small>{floor ? `${floor}F · 当前楼层` : '入口 · 候诊区'}</small><b>{room.replace(/ · \d+$/, '')}</b></div>
    </header>
  );
}

function VoiceButton({ text }: { text: string }) {
  return <button className="voice-button" onClick={() => speak(text)} aria-label="播放语音"><Volume2 size={18}/><span>听一听</span></button>;
}

function PatientWard({ patients, onSelect, onNew }: { patients: Patient[]; onSelect: (patient: Patient) => void; onNew: () => void }) {
  return (
    <main className="app-shell hospital-shell patient-ward-page">
      <HospitalHeader room="患者候诊区 · 00" color="#a474df"/>
      <section className="ward-hero">
        <div><div className="eyebrow"><UserRound size={16}/> MINI PATIENT ARCHIVE</div><h1>今天是谁<br/><em>来看病？</em></h1><p>每个积木小人都有自己的照片病历、贴纸收藏和回访电话。</p></div>
        <VoiceButton text="欢迎来到患者候诊区。请选择一位积木小患者，或者给新患者拍照挂号。"/>
      </section>
      <section className="patient-card-grid">
        {patients.map((patient) => (
          <button key={patient.id} className="saved-patient-card" onClick={() => onSelect(patient)}>
            <PatientAvatar patient={patient} size="large"/>
            {patient.pendingFollowUps > 0 && <span className="patient-call-badge">☎️ {patient.pendingFollowUps}</span>}
            <small>PATIENT NO. {patient.id.slice(0, 6).toUpperCase()}</small>
            <h2>{patient.name}</h2><p>{patient.age} 岁 · {patient.visitCount} 次就诊</p>
            <div><span>🏅 {patient.totalStickers} 枚贴纸</span><b>进入医院 →</b></div>
          </button>
        ))}
        <button className="new-patient-card" onClick={onNew}><span>📸</span><h2>新患者挂号</h2><p>拍一张病历照片，建立新的积木患者档案。</p><b>＋ 建立病历</b></button>
      </section>
      <div className="local-data-note"><ShieldCheck size={17}/><span><b>本地隐私模式</b>　患者照片和病历保存在这台电脑的 SQLite 积木医院数据库中，不会上传到互联网。</span></div>
    </main>
  );
}

function PatientRecordBook({ patient, history, onBack, onFollowUps }: { patient: Patient; history: HistoryResponse; onBack: () => void; onFollowUps: () => void }) {
  return (
    <main className="app-shell hospital-shell record-book-page">
      <HospitalHeader room="患者病历室 · 08" color="#4aa89a" onBack={onBack}/>
      <section className="record-book-hero">
        <PatientAvatar patient={patient} size="large"/>
        <div><small>MINI PATIENT RECORD</small><h1>{patient.name}的<br/><em>积木病历本</em></h1><p>{patient.age} 岁 · 已完成 {history.visits.length} 次就诊 · 收集 {history.rewards.length} 枚长期奖励</p></div>
        <button className="primary-hospital-btn" onClick={onFollowUps}><span>☎️</span>查看回访任务<ChevronRight/></button>
      </section>
      <section className="record-book-layout">
        <div className="visit-timeline">
          <div className="book-section-heading"><span>📚</span><div><small>VISIT HISTORY</small><h2>历史就诊记录</h2></div></div>
          {history.visits.length ? history.visits.map((visit, index) => <article key={visit.id} className="visit-history-card">
            <div className="visit-date"><b>{new Date(visit.completedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</b><span>第 {history.visits.length - index} 次就诊</span></div>
            <div className="visit-history-main"><div><small>{visit.diagnosisCode || '趣味综合检查'}</small><h3>综合能量 {visit.overallScore} 分</h3><p>{visit.symptoms.map((item) => symptomIcons[item as Symptom] || '🙂').join(' ')}　完成 {visit.results.length} 个科室</p></div><div className="visit-mini-stamps">{visit.results.map((item) => <span key={item.id}>{departmentCards.find((dept) => dept.id === item.id)?.icon || '🏥'}</span>)}</div></div>
            <details><summary>展开检查详情</summary><div className="visit-result-list">{visit.results.map((result) => <p key={result.id}><b>{result.name}</b><span>{result.summary}</span><i>{result.score}</i></p>)}</div></details>
          </article>) : <div className="empty-book"><span>📖</span><h3>病历本还是空白的</h3><p>完成一次出院流程后，检查结果会永久保存在这里。</p></div>}
        </div>
        <aside className="reward-cabinet">
          <div className="book-section-heading"><span>🏆</span><div><small>REWARD CABINET</small><h2>贴纸收藏柜</h2></div></div>
          <div className="reward-grid">{history.rewards.length ? history.rewards.map((reward) => <div key={reward.id}><span>{reward.code.startsWith('followup') ? '⭐' : '🎖️'}</span><b>{reward.name}</b><small>{new Date(reward.earnedAt).toLocaleDateString('zh-CN')}</small></div>) : <p>完成科室和回访任务，就能把贴纸放进收藏柜。</p>}</div>
        </aside>
      </section>
    </main>
  );
}

function FollowUpCenter({ patient, history, onBack, onComplete }: { patient: Patient; history: HistoryResponse; onBack: () => void; onComplete: (followUp: FollowUpRecord, data: { energyLevel: number; mood: string; note?: string }) => Promise<void> }) {
  const [active, setActive] = useState<FollowUpRecord | null>(null);
  const [mood, setMood] = useState('😄');
  const [energy, setEnergy] = useState(90);
  const [challenge, setChallenge] = useState('🌈 找到红黄蓝三种磁力片');
  const [stars, setStars] = useState(0);
  const [saving, setSaving] = useState(false);
  const [earned, setEarned] = useState('');
  const pending = history.followUps.filter((item) => item.status === 'pending');
  const complete = async () => {
    if (!active || saving) return;
    setSaving(true);
    await onComplete(active, { energyLevel: energy, mood, note: active.type === 'recovery_challenge' ? challenge : '' });
    setEarned(active.reward);
    setSaving(false);
    setActive(null);
  };
  if (earned) return <main className="app-shell hospital-shell followup-page"><HospitalHeader room="回访中心 · 09" color="#f08362" onBack={onBack}/><section className="followup-earned"><span>🎉</span><small>回访完成</small><h1>获得新奖励！</h1><div>⭐ {earned}</div><p>方块医生已经把这次恢复情况写进病历本。</p><button className="primary-hospital-btn" onClick={() => setEarned('')}><BadgeCheck/>收下奖励</button></section></main>;
  return (
    <main className="app-shell hospital-shell followup-page">
      <HospitalHeader room="回访中心 · 09" color="#f08362" onBack={onBack}/>
      <section className="followup-hero"><div className="followup-phone">☎️<i/></div><div><div className="eyebrow">DOCTOR FOLLOW-UP CALL</div><h1>方块医生来<br/><em>打回访电话啦</em></h1><p>{patient.name}完成出院后，医生会在第 1、3、7 个游戏日回来看看恢复情况。</p></div><VoiceButton text={`${patient.name}小朋友，方块医生来回访啦。让我们看看今天恢复得怎么样。`}/></section>
      {!active ? <section className="followup-dashboard">
        <div className="followup-timeline">
          {[1,3,7].map((day) => {
            const item = history.followUps.find((followUp) => followUp.sequence === day && followUp.status === 'pending') || history.followUps.find((followUp) => followUp.sequence === day);
            const config = day === 1 ? ['😊','能量表情回访','告诉医生今天感觉怎么样'] : day === 3 ? ['🏃','恢复挑战','完成一个轻轻的康复任务'] : ['🏅','最终康复检查','点亮五颗康复星星'];
            const due = item ? new Date(item.dueAt) <= new Date() : false;
            return <article key={day} className={`${item?.status === 'completed' ? 'completed' : ''} ${due ? 'due' : ''}`}><span>{config[0]}</span><div><small>第 {day} 个游戏日 {due && '· 今天到期'}</small><h3>{config[1]}</h3><p>{config[2]}</p>{item && <time>{new Date(item.dueAt).toLocaleDateString('zh-CN')}</time>}</div>{item?.status === 'completed' ? <b>✓ 已完成</b> : item ? <button onClick={() => { setActive(item); setStars(0); }}>现在回访</button> : <i>出院后开启</i>}</article>;
          })}
        </div>
        <aside className="followup-summary"><PatientAvatar patient={patient} size="medium"/><h2>{patient.name}</h2><p>等待回访 {pending.length} 项</p><div><span>🏆</span><b>{history.rewards.filter((item) => item.code.startsWith('followup')).length}/3</b><small>回访奖励</small></div></aside>
      </section> : <section className="followup-game play-panel">
        <button className="close-followup-game" onClick={() => setActive(null)}>×</button>
        {active.type === 'energy_check' && <div className="energy-check-game"><span className="game-giant-icon">😊</span><small>第 1 日回访</small><h2>今天感觉怎么样？</h2><div className="mood-choices">{[['😄','完全好了',100],['🙂','好一点了',80],['😴','还想休息',60],['😣','还是不舒服',40]].map(([icon,label,value]) => <button key={String(icon)} className={mood === icon ? 'active' : ''} onClick={() => { setMood(String(icon)); setEnergy(Number(value)); }}><span>{icon}</span><b>{label}</b></button>)}</div><div className="energy-meter"><span>能量</span><div><i style={{ width: `${energy}%` }}/></div><b>{energy}</b></div><button className="primary-hospital-btn" onClick={complete} disabled={saving}><BadgeCheck/>{saving ? '正在写入病历…' : '告诉方块医生'}</button></div>}
        {active.type === 'recovery_challenge' && <div className="recovery-game"><span className="game-giant-icon">🏃</span><small>第 3 日回访</small><h2>选一个恢复挑战</h2><div className="challenge-choices">{['🌈 找到红黄蓝三种磁力片','👣 让小人慢慢走 10 步','🤗 收集家人的 3 个拥抱'].map((item) => <button key={item} className={challenge === item ? 'active' : ''} onClick={() => setChallenge(item)}>{item}</button>)}</div><p>完成后大声说：“咔嗒咔嗒，我恢复啦！”</p><button className="primary-hospital-btn" onClick={complete} disabled={saving}><Trophy/>{saving ? '正在盖章…' : '我完成挑战了'}</button></div>}
        {active.type === 'final_review' && <div className="final-review-game"><span className="game-giant-icon">🏅</span><small>第 7 日回访</small><h2>点亮五颗康复星星</h2><div className="recovery-stars">{Array.from({length:5}).map((_, index) => <button key={index} onClick={() => setStars(Math.max(stars, index + 1))} className={index < stars ? 'lit' : ''}>★</button>)}</div><p>{stars < 5 ? `还差 ${5-stars} 颗星星` : '全部点亮，可以领取康复金印章！'}</p><button className="primary-hospital-btn" onClick={complete} disabled={stars < 5 || saving}><Trophy/>{saving ? '正在颁奖…' : '领取康复金印章'}</button></div>}
      </section>}
    </main>
  );
}

const departmentCards: Array<{ id: DepartmentId; icon: string; name: string; subtitle: string; color: string; tile: string; description: string }> = [
  { id: 'xray', icon: '🩻', name: 'X 光室', subtitle: '骨骼扫描', color: '#24cfc6', tile: '蓝色磁力片', description: '看看积木骨架和能量核心' },
  { id: 'orthopedics', icon: '🦴', name: '骨科', subtitle: '骨骼工程', color: '#45a9df', tile: '浅蓝磁力片', description: '把骨骼积木放回正确位置' },
  { id: 'internal', icon: '🩺', name: '能量内科', subtitle: '身体仪表', color: '#ef8b52', tile: '橙色磁力片', description: '检查温度、睡眠和呼吸泡泡' },
  { id: 'heart', icon: '💓', name: '心脏科', subtitle: '心跳检查', color: '#ff6a5b', tile: '红色磁力片', description: '跟着咚咚节奏点亮勇气核心' },
  { id: 'gastro', icon: '🫃', name: '肠胃科', subtitle: '肚肚列车', color: '#9a75d6', tile: '紫色磁力片', description: '帮食物列车通过肚肚迷宫' },
  { id: 'surgery', icon: '🩹', name: '积木外科', subtitle: '外壳维修', color: '#eb6687', tile: '粉色磁力片', description: '清洁、贴补丁、包好创可贴' },
  { id: 'dental', icon: '🦷', name: '牙科', subtitle: '糖果虫清理', color: '#f5b82e', tile: '黄色磁力片', description: '找出藏在牙齿里的糖果虫' },
  { id: 'pharmacy', icon: '💊', name: '彩虹药房', subtitle: '能量配药', color: '#58b96a', tile: '绿色磁力片', description: '按处方装好三种彩色能量' },
];

function buildTreatmentRoute(selectedSymptoms: Symptom[]): DepartmentId[] {
  const route: DepartmentId[] = [];
  const add = (...ids: DepartmentId[]) => ids.forEach((id) => { if (!route.includes(id)) route.push(id); });
  if (selectedSymptoms.some((item) => ['走路咔嗒响', '骨头松松的'].includes(item))) add('xray', 'orthopedics');
  if (selectedSymptoms.includes('外壳擦伤')) add('surgery', 'orthopedics');
  if (selectedSymptoms.some((item) => ['肚子痛', '肚肚咕噜'].includes(item))) add('gastro', 'internal');
  if (selectedSymptoms.some((item) => ['没精神', '头晕晕', '笑不出来', '身体热热的'].includes(item))) add('internal', 'heart');
  if (!route.length) add('xray');
  return [...route.slice(0, 4), 'pharmacy'];
}

type BuildingRoom = {
  route: string;
  icon: string;
  name: string;
  childHint: string;
  color: string;
  departmentId?: DepartmentId;
};

const buildingFloors: Array<{ floor: number; name: string; rooms: [BuildingRoom, BuildingRoom] }> = [
  { floor: 6, name: '康复屋顶', rooms: [
    { route: 'discharge', icon: '🎖️', name: '出院中心', childHint: '领勇敢证书', color: '#9b6bd1' },
    { route: 'followups', icon: '☎️', name: '回访中心', childHint: '接医生电话', color: '#ef765b' },
  ] },
  { floor: 5, name: '彩虹护理层', rooms: [
    { route: 'dental', icon: '🦷', name: '牙科', childHint: '赶走糖果虫', color: '#f5b82e', departmentId: 'dental' },
    { route: 'pharmacy', icon: '💊', name: '彩虹药房', childHint: '配能量药', color: '#58b96a', departmentId: 'pharmacy' },
  ] },
  { floor: 4, name: '积木修理层', rooms: [
    { route: 'gastro', icon: '🫃', name: '肠胃科', childHint: '开动肚肚列车', color: '#9a75d6', departmentId: 'gastro' },
    { route: 'surgery', icon: '🩹', name: '积木外科', childHint: '修好小小擦伤', color: '#eb6687', departmentId: 'surgery' },
  ] },
  { floor: 3, name: '能量检查层', rooms: [
    { route: 'internal', icon: '🩺', name: '能量内科', childHint: '调好身体仪表', color: '#ef8b52', departmentId: 'internal' },
    { route: 'heart', icon: '💓', name: '心脏科', childHint: '听咚咚心跳', color: '#ff6a5b', departmentId: 'heart' },
  ] },
  { floor: 2, name: '骨骼检查层', rooms: [
    { route: 'xray', icon: '🩻', name: 'X 光室', childHint: '看看积木骨架', color: '#24cfc6', departmentId: 'xray' },
    { route: 'orthopedics', icon: '🦴', name: '骨科', childHint: '拼好骨骼积木', color: '#45a9df', departmentId: 'orthopedics' },
  ] },
  { floor: 1, name: '欢迎大厅', rooms: [
    { route: 'triage', icon: '👩‍⚕️', name: '挂号台', childHint: '告诉护士哪里痛', color: '#ffca28' },
    { route: 'records', icon: '📖', name: '病历室', childHint: '翻翻照片病历', color: '#4aa89a' },
  ] },
];

function HospitalBuilding({ journey, history, onRoute }: { journey: JourneyState; history: HistoryResponse; onRoute: (route: string) => void }) {
  const visited = new Set(journey.results.map((result) => result.id));
  const pendingFollowUps = history.followUps.filter((item) => item.status === 'pending');
  const dueFollowUps = pendingFollowUps.filter((item) => new Date(item.dueAt) <= new Date());
  const plannedRoute = journey.plannedRoute?.length ? journey.plannedRoute : buildTreatmentRoute(journey.patient.symptoms);
  const nextDepartment = plannedRoute.find((department) => !visited.has(department));
  const nextRoute = journey.archivedVisitId
    ? (dueFollowUps.length ? 'followups' : 'records')
    : nextDepartment || 'discharge';
  const nextRoom = buildingFloors.flatMap((item) => item.rooms).find((room) => room.route === nextRoute)!;
  const nextFloor = buildingFloors.find((item) => item.rooms.some((room) => room.route === nextRoute))?.floor || 1;

  const roomState = (room: BuildingRoom) => {
    const done = room.departmentId ? visited.has(room.departmentId) : room.route === 'triage' ? journey.registered : room.route === 'discharge' ? Boolean(journey.archivedVisitId) : false;
    const locked = room.route === 'pharmacy' && !journey.results.some((item) => item.id !== 'pharmacy');
    const badge = room.route === 'followups' && dueFollowUps.length ? `☎ ${dueFollowUps.length} 个电话` : done ? '✓ 完成' : room.route === nextRoute ? '下一站' : locked ? '🔒 先检查' : '';
    return { done, locked, badge };
  };

  return (
    <section className="building-section">
      <div className="next-stop-card" style={{ '--next-color': nextRoom.color } as React.CSSProperties}>
        <div className="next-stop-number">{Math.min(plannedRoute.length + 1, journey.results.filter((item) => plannedRoute.includes(item.id)).length + 1)}</div>
        <span className="next-stop-icon">{nextRoom.icon}</span>
        <div><small>方块护士说 · NEXT STOP</small><h2>下一站：{nextFloor} 楼 {nextRoom.name}</h2><p>{nextRoom.childHint}，跟着亮起来的电梯走！</p></div>
        <button onClick={() => onRoute(nextRoute)}>乘电梯去 {nextFloor} 楼 <ChevronRight size={20}/></button>
      </div>

      <div className="building-heading">
        <div><span>🏥 HOSPITAL BUILDING</span><h2>一眼看懂整栋医院</h2></div>
        <p>亮灯的是下一站 · 打勾的是去过的房间</p>
      </div>

      <div className="hospital-building" aria-label="六层积木医院地图">
        <div className="building-roof"><span>H</span><b>🚁</b><i/><i/><i/></div>
        {buildingFloors.map((level) => (
          <div key={level.floor} className={`building-floor floor-${level.floor} ${level.floor === nextFloor ? 'is-current' : ''}`}>
            <div className="floor-sign"><strong>{level.floor}F</strong><span>{level.name}</span></div>
            {level.rooms.map((room, roomIndex) => {
              const state = roomState(room);
              return (
                <React.Fragment key={room.route}>
                  {roomIndex === 1 && <div className={`building-elevator ${level.floor === nextFloor ? 'arrived' : ''}`}>
                    <span className="elevator-floor">{level.floor}</span>
                    {level.floor === nextFloor ? <div className="elevator-car"><PatientAvatar patient={journey.patient} size="small"/><b>叮！</b></div> : <div className="elevator-doors"><i/><i/></div>}
                  </div>}
                  <button
                    className={`building-room ${state.done ? 'done' : ''} ${state.locked ? 'locked' : ''} ${room.route === nextRoute ? 'recommended' : ''}`}
                    style={{ '--room-accent': room.color } as React.CSSProperties}
                    disabled={state.locked}
                    onClick={() => onRoute(room.route)}
                    aria-label={`${level.floor}楼${room.name}${state.badge ? `，${state.badge}` : ''}`}
                  >
                    {state.badge && <b className="room-badge">{state.badge}</b>}
                    <span className="room-emoji">{room.icon}</span>
                    <span className="room-copy"><strong>{room.name}</strong><small>{room.childHint}</small></span>
                    <ChevronRight className="room-arrow" size={20}/>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        ))}
        <div className="building-ground"><span>🚑</span><i/><i/><button onClick={() => onRoute('print')}><Printer size={16}/>纸上游戏打印机</button><i/><i/><span>🌳</span></div>
      </div>
      <div className="building-legend">
        <span>✨ 下一站会发光</span><span>✅ 做完就盖章</span><span>🛗 电梯带你上楼</span><span>👆 也可以自由探索</span>
      </div>
    </section>
  );
}

function HospitalLobby({ journey, history, onRoute, onSwitch }: { journey: JourneyState; history: HistoryResponse; onRoute: (route: string) => void; onSwitch: () => void }) {
  const visited = new Set(journey.results.map((result) => result.id));
  const plannedRoute = journey.plannedRoute?.length ? journey.plannedRoute : buildTreatmentRoute(journey.patient.symptoms);
  return (
    <main className="app-shell hospital-shell">
      <HospitalHeader room="医院大厅 · 01"/>
      <section className="lobby-hero">
        <div className="lobby-title">
          <div className="eyebrow"><MapPinned size={16}/> 今日积木医院开放中</div>
          <h1>欢迎来到<br/><em>咔嗒咔嗒医院</em></h1>
          <p>搭好磁力片诊室，带着小患者完成一次勇敢的看病冒险。</p>
          <div className="lobby-actions">
            <button className="primary-hospital-btn" onClick={() => onRoute('triage')}><span>👩‍⚕️</span>{journey.registered ? '修改挂号信息' : '先去挂号分诊'}<ChevronRight size={19}/></button>
            <VoiceButton text={journey.registered ? `${journey.patient.name}小朋友，欢迎回来。请选择今天想去的科室。` : '欢迎来到咔嗒咔嗒积木医院。请先带小患者去挂号分诊。'}/>
            <button className="quiet-hospital-btn" onClick={onSwitch}><span>👥</span>换患者</button>
          </div>
        </div>
        <div className={`patient-passport ${journey.registered ? 'is-ready' : ''}`}>
          <div className="passport-hole"/>
          <span className="passport-kicker">MINI PATIENT PASS</span>
          {journey.registered ? <PatientAvatar patient={journey.patient} size="large"/> : <div className="passport-avatar">❔</div>}
          <h2>{journey.registered ? journey.patient.name : '等待挂号'}</h2>
          <p>{journey.registered ? `${journey.patient.age} 岁 · ${journey.patient.symptoms.map((s) => symptomIcons[s]).join(' ') || '😊'}` : '先填写小患者资料'}</p>
          <div className="passport-stamps">
            {plannedRoute.map((id) => { const dept = departmentCards.find((item) => item.id === id)!; return <span key={dept.id} className={visited.has(dept.id) ? 'earned' : ''}>{visited.has(dept.id) ? dept.icon : '○'}</span>; })}
          </div>
          <small>今日路线完成 {plannedRoute.filter((id) => visited.has(id)).length} / {plannedRoute.length} 站</small>
        </div>
      </section>

      <HospitalBuilding journey={journey} history={history} onRoute={onRoute}/>
      <footer className="page-footer"><span>CLICK-CLACK CHILDREN'S CLINIC</span><p>让每一个磁力片房间，都有自己的故事。</p><b>♥</b></footer>
    </main>
  );
}

function TriageDesk({ patient, onBack, onSave }: { patient: Patient; onBack: () => void; onSave: (patient: Patient, photoDataUrl: string) => Promise<void> }) {
  const [name, setName] = useState(patient.name);
  const [age, setAge] = useState(patient.age);
  const [selected, setSelected] = useState<Symptom[]>(patient.symptoms);
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoBackground, setPhotoBackground] = useState(patient.photoBackground || 'rainbow');
  const [photoError, setPhotoError] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const recommendedDepartment = departmentCards.find((item) => item.id === buildTreatmentRoute(selected)[0])!;
  const recommended = `${recommendedDepartment.icon} ${recommendedDepartment.name}`;
  const toggle = (symptom: Symptom) => setSelected((current) => current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]);
  const draftPatient = { ...patient, name, age, photoBackground, symptoms: selected };
  const choosePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoError('');
    try { setPhotoDataUrl(await preparePatientPhoto(file)); }
    catch (error) { setPhotoError(error instanceof Error ? error.message : '照片处理失败'); }
  };
  const submit = async () => {
    if (saving) return;
    if (!name.trim()) {
      setNameError('先给小患者取一个名字，按钮就会带你去大厅');
      nameInputRef.current?.focus();
      return;
    }
    if (!age) return;
    setSaving(true);
    setPhotoError('');
    try { await onSave({ ...draftPatient, name: name.trim(), symptoms: selected.length ? selected : ['没精神'] }, photoDataUrl); }
    catch (error) { setPhotoError(error instanceof Error ? error.message : '病历保存失败'); setSaving(false); }
  };
  return (
    <main className="app-shell hospital-shell triage-page">
      <HospitalHeader room="挂号分诊台 · 02" color="#ffca28" onBack={onBack}/>
      <section className="department-hero triage-hero">
        <div><span className="department-big-icon">👩‍⚕️</span><div className="eyebrow">PATIENT CHECK-IN</div><h1>先给小患者<br/><em>挂个号</em></h1><p>告诉方块护士哪里不舒服，她会画出今天的医院路线。</p></div>
        <VoiceButton text="请告诉我小患者的名字、年龄，还有今天哪里不舒服。"/>
      </section>
      <section className="triage-board play-panel">
        <div className="triage-form">
          <div className="photo-registration">
            <PatientAvatar patient={draftPatient} size="large" photoDataUrl={photoDataUrl}/>
            <div className="photo-registration-copy"><span>病历照片</span><h3>{patient.id ? '更新小患者照片' : '给小患者拍张照'}</h3><p>照片只保存在这台电脑的积木医院里。</p>
              <label className="photo-upload-button"><span>📷</span>{patient.photoUrl || photoDataUrl ? '重新拍照' : '拍照 / 选择照片'}<input type="file" accept="image/*" capture="environment" onChange={(event) => choosePhoto(event.target.files?.[0])}/></label>
            </div>
          </div>
          <div className="photo-backgrounds"><span>选择病历背景</span>{[['rainbow','🌈'],['space','🚀'],['dinosaur','🦖'],['castle','🏰']].map(([value, icon]) => <button key={value} className={photoBackground === value ? 'active' : ''} onClick={() => setPhotoBackground(value)}>{icon}</button>)}</div>
          {photoError && <div className="form-error">⚠️ {photoError}</div>}
          <label htmlFor="patient-name">小患者叫什么名字？</label>
          <div className={`kid-input ${nameError ? 'has-error' : ''}`}><span>🙂</span><input id="patient-name" ref={nameInputRef} aria-label="小患者名字" placeholder="点这里输入名字，例如：小火箭" value={name} onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(''); }} maxLength={12}/></div>
          {nameError && <div className="name-help">👆 {nameError}</div>}
          <label>今年几岁？</label>
          <div className="kid-input age"><span>🎂</span><input type="number" min="1" max="99" value={age} onChange={(e) => setAge(e.target.value)}/><b>岁</b></div>
          <label>今天哪里不舒服？ <small>可以选几个</small></label>
          <div className="triage-symptoms">
            {symptoms.map((symptom) => <button key={symptom} className={selected.includes(symptom) ? 'active' : ''} onClick={() => toggle(symptom)}><span>{symptomIcons[symptom]}</span><b>{symptom}</b><i>{selected.includes(symptom) ? '✓' : ''}</i></button>)}
          </div>
        </div>
        <aside className="triage-route">
          <span className="route-label">护士推荐路线</span>
          <div className="route-patient">{name ? '🧑‍🚀' : '❔'}<b>{name || '神秘小患者'}</b></div>
          <div className="route-line"><i/><i/><i/></div>
          <div className="route-destination"><small>第一站推荐</small><strong>{recommended}</strong><p>这只是游戏路线，也可以回大厅选择其他科室。</p></div>
          <div className="route-ticket"><span>排队号码</span><b>A-{String((name.length * 7 + Number(age || 0)) % 99).padStart(2, '0')}</b></div>
          <button className={`primary-hospital-btn ${!name.trim() ? 'needs-name' : ''}`} disabled={saving} onClick={submit}><BadgeCheck size={20}/>{saving ? '正在保存病历…' : !name.trim() ? '先填写名字，再去大厅' : '完成挂号，去大厅'}<ChevronRight size={18}/></button>
        </aside>
      </section>
    </main>
  );
}

function DepartmentResultCard({ result, onComplete }: { result: DepartmentResult; onComplete: () => void }) {
  return (
    <div className="department-result-card">
      <div className="result-confetti">✦　·　✦　·　✦</div>
      <span className="result-big-emoji">{result.icon}</span>
      <small>检查完成</small><h2>{result.summary}</h2><p>{result.detail}</p>
      <div className="result-score"><strong>{result.score}</strong><span>/100<br/>健康能量</span></div>
      <div className="result-sticker"><Trophy size={18}/>{result.sticker}</div>
      <button className="primary-hospital-btn" onClick={onComplete}><BadgeCheck size={19}/>收下贴纸，返回大厅</button>
    </div>
  );
}

function HeartDepartment({ patient, onBack, onComplete }: { patient: Patient; onBack: () => void; onComplete: (result: DepartmentResult) => void }) {
  const [beats, setBeats] = useState(0);
  const done = beats >= 8;
  const score = 88 + ((patient.name.length * 3 + Number(patient.age || 0)) % 11);
  const result: DepartmentResult = { id: 'heart', name: '心脏科', icon: '💓', score, summary: '勇气核心节奏稳定', detail: '咚咚节奏整齐，发现几颗暖暖的拥抱粒子，补充快乐后会跳得更有力量。', sticker: '心跳节奏大师' };
  const tap = () => {
    if (done) return;
    const next = beats + 1;
    setBeats(next);
  };
  return (
    <main className="app-shell hospital-shell heart-page">
      <HospitalHeader room="心脏科 · 04" color="#ff6a5b" onBack={onBack}/>
      <section className="department-hero compact-dept-hero"><div><span className="department-big-icon">💓</span><div className="eyebrow">BRAVE HEART LAB</div><h1>勇气核心<br/><em>心跳检查</em></h1><p>用红色磁力片搭好心脏室，跟着节奏点击大爱心。</p></div><VoiceButton text="请把小患者放进红色心脏室。跟着咚咚声点击八次大爱心。"/></section>
      <section className="play-panel heart-lab">
        {!done ? <>
          <div className="heart-monitor">
            <div className="monitor-head"><span>LIVE HEART</span><b>{72 + beats * 2} BPM</b></div>
            <div className="ekg-line"><i/><i/><i/><i/><i/><i/></div>
            <button className="giant-heart" onClick={tap} aria-label="点击心跳"><span>💛</span><b>咚！</b></button>
            <div className="beat-dots">{Array.from({ length: 8 }).map((_, index) => <i key={index} className={index < beats ? 'filled' : ''}/>)}</div>
            <p>{beats === 0 ? '准备好了吗？点击大爱心开始检查' : `已经听到 ${beats} 次心跳，还差 ${8 - beats} 次`}</p>
          </div>
          <aside className="game-instructions"><span>红色磁力片任务</span><div className="instruction-emoji">🟥</div><h3>搭建心脏检查室</h3><ol><li><b>1</b>把小人放进红色房间</li><li><b>2</b>用手指点击大爱心</li><li><b>3</b>集齐 8 个咚咚声</li></ol></aside>
        </> : <DepartmentResultCard result={result} onComplete={() => onComplete(result)}/>}
      </section>
    </main>
  );
}

function DentalDepartment({ patient, onBack, onComplete }: { patient: Patient; onBack: () => void; onComplete: (result: DepartmentResult) => void }) {
  const seed = patient.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), Number(patient.age || 0));
  const bugs = useMemo(() => [seed % 8, (seed + 3) % 8, (seed + 5) % 8], [seed]);
  const [cleaned, setCleaned] = useState<number[]>([]);
  const done = cleaned.length === bugs.length;
  const score = 90 + (seed % 9);
  const result: DepartmentResult = { id: 'dental', name: '牙科', icon: '🦷', score, summary: '糖果虫已经全部搬家', detail: '八颗积木牙齿都很坚固，三只糖果虫已经被泡泡牙刷安全送走。', sticker: '刷牙小卫士' };
  const cleanTooth = (index: number) => {
    if (!bugs.includes(index) || cleaned.includes(index)) return;
    const next = [...cleaned, index];
    setCleaned(next);
  };
  return (
    <main className="app-shell hospital-shell dental-page">
      <HospitalHeader room="牙科 · 05" color="#f5b82e" onBack={onBack}/>
      <section className="department-hero compact-dept-hero"><div><span className="department-big-icon">🦷</span><div className="eyebrow">HAPPY TOOTH CLINIC</div><h1>寻找调皮的<br/><em>糖果虫</em></h1><p>有三只糖果虫躲在牙齿后面，点击它们把牙齿刷干净。</p></div><VoiceButton text="请找到三只糖果虫。看到糖果的牙齿就点一下，用泡泡牙刷把它刷干净。"/></section>
      <section className="play-panel dental-lab">
        {!done ? <>
          <div className="mouth-stage">
            <div className="mouth-lip top"/><div className="teeth-grid">
              {Array.from({ length: 8 }).map((_, index) => {
                const hasBug = bugs.includes(index) && !cleaned.includes(index);
                const isClean = cleaned.includes(index);
                return <button key={index} aria-label={hasBug ? `第 ${index + 1} 颗牙齿有糖果虫` : isClean ? `第 ${index + 1} 颗牙齿已经刷干净` : `第 ${index + 1} 颗牙齿很健康`} onClick={() => cleanTooth(index)} className={`${hasBug ? 'has-bug' : ''} ${isClean ? 'is-clean' : ''}`}><span>🦷</span>{hasBug && <i>🍬</i>}{isClean && <b>✨</b>}</button>;
              })}
            </div><div className="mouth-lip bottom"/>
            <div className="clean-progress"><span>泡泡牙刷进度</span><div><i style={{ width: `${cleaned.length / 3 * 100}%` }}/></div><b>{cleaned.length}/3</b></div>
          </div>
          <aside className="game-instructions yellow"><span>黄色磁力片任务</span><div className="instruction-emoji">🟨</div><h3>搭建牙齿检查室</h3><ol><li><b>1</b>把小人放进黄色房间</li><li><b>2</b>寻找带有 🍬 的牙齿</li><li><b>3</b>点击三次完成清洁</li></ol></aside>
        </> : <DepartmentResultCard result={result} onComplete={() => onComplete(result)}/>}
      </section>
    </main>
  );
}

const medicines = [
  { color: '#ff6656', emoji: '🟥', name: '勇气红' }, { color: '#ffca2b', emoji: '🟨', name: '快乐黄' },
  { color: '#47b96a', emoji: '🟩', name: '休息绿' }, { color: '#3c93df', emoji: '🟦', name: '清凉蓝' },
  { color: '#9a72df', emoji: '🟪', name: '梦境紫' }, { color: '#ff8dc1', emoji: '🩷', name: '拥抱粉' },
] as const;

function PharmacyDepartment({ patient, previousResults, onBack, onComplete }: { patient: Patient; previousResults: DepartmentResult[]; onBack: () => void; onComplete: (result: DepartmentResult) => void }) {
  const seed = patient.name.length * 7 + Number(patient.age || 0) + previousResults.length * 11;
  const order = useMemo(() => [medicines[seed % 6], medicines[(seed + 2) % 6], medicines[(seed + 4) % 6]], [seed]);
  const [filled, setFilled] = useState(0);
  const [feedback, setFeedback] = useState('请找到处方上的第一种颜色');
  const done = filled >= order.length;
  const score = 92 + (seed % 7);
  const result: DepartmentResult = { id: 'pharmacy', name: '彩虹药房', icon: '💊', score, summary: '彩虹能量药已经配好', detail: `药袋里装好了${order.map((item) => item.name).join('、')}，按快乐处方休息就会慢慢恢复。`, sticker: '彩虹配药小助手' };
  const selectMedicine = (name: string) => {
    if (done) return;
    if (name === order[filled].name) {
      const next = filled + 1;
      setFilled(next);
      setFeedback(next === order.length ? '配药成功！' : `正确！再找 ${order[next].name}`);
    } else {
      setFeedback(`颜色不对，再找找 ${order[filled].name}`);
    }
  };
  return (
    <main className="app-shell hospital-shell pharmacy-page">
      <HospitalHeader room="彩虹药房 · 06" color="#58b96a" onBack={onBack}/>
      <section className="department-hero compact-dept-hero"><div><span className="department-big-icon">💊</span><div className="eyebrow">RAINBOW PHARMACY</div><h1>按颜色配好<br/><em>能量药</em></h1><p>看看处方顺序，再把三种正确颜色装进药袋。</p></div><VoiceButton text="请按照处方，从左到右找到三种正确颜色，把彩虹能量装进药袋。"/></section>
      <section className="play-panel pharmacy-lab">
        {!done ? <>
          <div className="pharmacy-counter">
            <div className="prescription-order"><span>方块医生的颜色处方</span><div>{order.map((item, index) => <article key={item.name} className={index < filled ? 'filled' : index === filled ? 'current' : ''}><b>{index < filled ? '✓' : item.emoji}</b><small>{item.name}</small></article>)}</div></div>
            <div className="medicine-shelf">{medicines.map((medicine) => <button key={medicine.name} style={{ '--medicine': medicine.color } as React.CSSProperties} onClick={() => selectMedicine(medicine.name)}><span>🧪</span><b>{medicine.emoji}</b><small>{medicine.name}</small></button>)}</div>
            <div className="medicine-bag"><span>🛍️</span><div>{order.slice(0, filled).map((item) => <i key={item.name}>{item.emoji}</i>)}</div><p>{feedback}</p></div>
          </div>
          <aside className="game-instructions green"><span>绿色磁力片任务</span><div className="instruction-emoji">🟩</div><h3>搭建彩虹药房</h3><ol><li><b>1</b>看看处方颜色顺序</li><li><b>2</b>从架子找到相同颜色</li><li><b>3</b>装满三格能量药袋</li></ol></aside>
        </> : <DepartmentResultCard result={result} onComplete={() => onComplete(result)}/>}
      </section>
    </main>
  );
}

type ExpansionDepartmentId = 'orthopedics' | 'internal' | 'gastro' | 'surgery';
type ExpansionConfig = {
  id: ExpansionDepartmentId;
  name: string;
  icon: string;
  color: string;
  english: string;
  headline: string;
  emphasis: string;
  intro: string;
  tile: string;
  sticker: string;
  drawPrompt: string;
  conditions: readonly string[];
  causes: readonly string[];
  treatments: ReadonlyArray<readonly [string, string]>;
  steps: ReadonlyArray<readonly [string, string]>;
};

const playfulCauses = [
  '火箭降落时轻轻颠了一下', '积木舞会连续转了好多圈', '昨天帮助了太多小伙伴', '彩虹滑梯来回玩了十次', '睡觉时像小陀螺一样翻滚',
  '恐龙追逐赛跑得太快', '脑袋里装进了太多故事', '泡泡派对玩得忘记休息', '搬运磁力片时特别认真', '超级英雄任务持续太久',
] as const;

const expansionConfigs: Record<ExpansionDepartmentId, ExpansionConfig> = {
  orthopedics: {
    id: 'orthopedics', name: '骨科', icon: '🦴', color: '#45a9df', english: 'BRICK BONE WORKSHOP', headline: '拼好身体里的', emphasis: '骨骼积木', intro: '按照蓝图依次装好脚、腿、身体和手臂，让骨骼工程重新稳稳站好。', tile: '浅蓝色磁力片', sticker: '骨骼工程师', drawPrompt: '画一副你设计的超级骨骼盔甲',
    conditions: ['弹簧腿疲劳症','关节咔嗒打结症','骨骼积木排队症','鞋底不平衡症','膝盖齿轮偷懒症','手臂连接松松症','跑步缓冲不足症','身体支架歪歪症','跳跃弹力用完症','骨骼蓝图迷路症'],
    causes: playfulCauses,
    treatments: [['🧘','做三次慢慢伸展'],['🛏️','在软垫基地休息五分钟'],['🤗','收集三个加固拥抱'],['👣','沿直线慢慢走十步'],['🧱','搭一个骨骼支撑小屋'],['🌙','今晚给腿部充足睡眠'],['🥤','慢慢喝一杯能量水'],['🎵','跟着轻音乐摆摆手脚'],['🦸','暂停一次超级跳跃任务'],['⭐','每天涂亮一颗骨骼星']],
    steps: [['🦶','装好小脚'],['🦵','接上腿部'],['🦴','放稳身体'],['💪','装好手臂']],
  },
  surgery: {
    id: 'surgery', name: '积木外科', icon: '🩹', color: '#eb6687', english: 'GENTLE REPAIR STATION', headline: '修好小小的', emphasis: '外壳擦伤', intro: '这里没有可怕的手术，只有清洁泡泡、彩色补丁和勇敢创可贴。', tile: '粉色磁力片', sticker: '温柔维修大师', drawPrompt: '给小患者设计一张最酷的创可贴',
    conditions: ['外壳擦花症','创可贴缺失症','零件轻微松动症','披风卡住症','按钮小磕碰症','头盔划痕症','手套磨损症','背包扣松松症','积木边角灰尘症','维修贴纸掉落症'],
    causes: playfulCauses,
    treatments: [['🫧','用想象泡泡轻轻清洁'],['🩹','贴好三枚勇敢补丁'],['🤗','维修后收集一个拥抱'],['🛋️','在维修站休息十分钟'],['🧸','请玩具护士陪伴'],['👐','轻轻检查四肢连接'],['🌈','给补丁画上彩虹'],['🛡️','今天穿好保护盔甲'],['⭐','每完成一次护理涂一颗星'],['💬','大声说我已经修好啦']],
    steps: [['🫧','泡泡清洁'],['🔍','检查外壳'],['🟨','贴上补丁'],['🩹','盖好创可贴']],
  },
  internal: {
    id: 'internal', name: '能量内科', icon: '🩺', color: '#ef8b52', english: 'INNER ENERGY LAB', headline: '调好身体的', emphasis: '能量仪表', intro: '把温度、睡眠、呼吸泡泡和快乐电量全部充到绿色区域。', tile: '橙色磁力片', sticker: '身体仪表专家', drawPrompt: '画出身体里最亮的能量核心',
    conditions: ['能量电池不足症','睡眠充电失败症','快乐温度过高症','呼吸泡泡堵车症','故事装得太满症','核心亮度下降症','慢动作省电症','想象粒子迷路症','拥抱电量偏低症','午睡信号丢失症'],
    causes: playfulCauses,
    treatments: [['🌬️','做三次魔法深呼吸'],['🌙','提早进入枕头充电站'],['🥤','慢慢喝水补充能量'],['🤗','获得三个暖暖拥抱'],['🎵','听一首安静的小歌'],['🛋️','安静坐十分钟'],['☀️','到窗边收集温柔阳光'],['📚','一次只听一个故事'],['😄','讲一个让自己笑的笑话'],['⭐','每天记录一格快乐电量']],
    steps: [['🌡️','调好温度'],['🌬️','疏通呼吸泡泡'],['🌙','补满睡眠'],['🔋','充好快乐电量']],
  },
  gastro: {
    id: 'gastro', name: '肠胃科', icon: '🫃', color: '#9a75d6', english: 'TUMMY TRAIN STATION', headline: '开动肚肚里的', emphasis: '食物列车', intro: '按顺序打开五座小车站，让苹果、水和饼干安全通过肚肚迷宫。', tile: '紫色磁力片', sticker: '肚肚列车长', drawPrompt: '画一条食物列车穿过的肚肚隧道',
    conditions: ['饼干碎屑塞车症','肚肚泡泡太多症','彩虹汤装太满症','消化齿轮偷懒症','苹果列车晚点症','喝水小河变窄症','早餐车站没开门症','肚肚鼓声太响症','蔬菜乘客迷路症','点心红灯等待症'],
    causes: playfulCauses,
    treatments: [['🥤','慢慢喝一小杯水'],['🍎','给苹果列车一个座位'],['🚶','饭后慢慢走十步'],['🫧','轻轻呼出三颗肚肚泡泡'],['🛋️','坐在软垫上休息'],['🥕','邀请一种彩色蔬菜乘车'],['⏰','让点心车站按时开门'],['🤗','给肚肚一个暖暖拥抱'],['🌙','睡觉时让消化齿轮休息'],['⭐','每次舒服一点就涂一颗星']],
    steps: [['🍎','苹果站'],['🥤','水滴桥'],['🍪','饼干弯道'],['🫧','泡泡隧道'],['🏁','快乐终点']],
  },
};

function makeExpansionResult(config: ExpansionConfig, patient: Patient): DepartmentResult {
  const seed = patient.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), Number(patient.age || 0) * 97) + config.id.length * 7919 + new Date().getDate();
  const random = createRandom(seed);
  const condition = choose(config.conditions, random);
  const cause = choose(config.causes, random);
  const start = Math.floor(random() * config.treatments.length);
  const prescription = [0, 3, 6].map((offset, index) => {
    const treatment = config.treatments[(start + offset) % config.treatments.length];
    return { icon: treatment[0], text: treatment[1], targetCount: [3, 5, 7][index] };
  });
  const score = 84 + Math.floor(random() * 15);
  return {
    id: config.id, name: config.name, icon: config.icon, score, seed,
    summary: condition,
    detail: `${cause}，让身体里出现了“${condition}”。完成${config.name}任务后，各个积木连接已经重新变得稳稳的。`,
    sticker: config.sticker, diagnosisEmoji: config.icon, drawPrompt: config.drawPrompt,
    findings: [
      { icon: '🟢', label: '积木连接', value: `${93 + Math.floor(random() * 7)}%` },
      { icon: config.icon, label: '科室能量', value: `${70 + Math.floor(random() * 24)}%` },
      { icon: '⭐', label: '勇敢指数', value: `${score}%` },
    ],
    prescription,
  };
}

function ExpansionDepartment({ id, patient, onBack, onComplete }: { id: ExpansionDepartmentId; patient: Patient; onBack: () => void; onComplete: (result: DepartmentResult) => void }) {
  const config = expansionConfigs[id];
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState(`先完成：${config.steps[0][1]}`);
  const result = useMemo(() => makeExpansionResult(config, patient), [config, patient]);
  const done = step >= config.steps.length;
  const chooseStep = (index: number) => {
    if (index < step) return;
    if (index !== step) { setMessage(`顺序还没到，先做“${config.steps[step][1]}”`); return; }
    const next = step + 1;
    setStep(next);
    setMessage(next >= config.steps.length ? '全部完成，检查结果出来啦！' : `做得好！下一步：${config.steps[next][1]}`);
  };
  return (
    <main className={`app-shell hospital-shell expansion-page ${id}-page`} style={{ '--expansion-color': config.color } as React.CSSProperties}>
      <HospitalHeader room={`${config.name} · 新科室`} color={config.color} onBack={onBack}/>
      <section className="department-hero compact-dept-hero"><div><span className="department-big-icon">{config.icon}</span><div className="eyebrow">{config.english}</div><h1>{config.headline}<br/><em>{config.emphasis}</em></h1><p>{config.intro}</p></div><VoiceButton text={`${config.name}到了。${config.intro}`}/></section>
      <section className="play-panel expansion-lab">
        {!done ? <>
          <div className={`expansion-stage ${id}-stage`}>
            <div className="expansion-monitor"><span>{config.icon} {config.name}任务</span><b>{step}/{config.steps.length}</b></div>
            <div className="expansion-scene" aria-label={`${config.name}游戏画面`}>
              {id === 'orthopedics' && <div className="bone-blueprint"><i>💀</i>{config.steps.map((item, index) => <span key={item[1]} className={index < step ? 'lit' : ''}>{item[0]}</span>)}</div>}
              {id === 'surgery' && <div className="repair-patient"><span>🧑‍🚀</span><div>{config.steps.slice(0, step).map((item) => <i key={item[1]}>{item[0]}</i>)}</div></div>}
              {id === 'internal' && <div className="energy-console">{config.steps.map((item, index) => <article key={item[1]}><span>{item[0]}</span><div><i style={{ width: `${index < step ? 100 : index === step ? 42 : 12}%` }}/></div><b>{index < step ? 'OK' : '…'}</b></article>)}</div>}
              {id === 'gastro' && <div className="tummy-track">{config.steps.map((item, index) => <React.Fragment key={item[1]}><span className={index < step ? 'passed' : index === step ? 'current' : ''}>{item[0]}</span>{index < config.steps.length - 1 && <i>···</i>}</React.Fragment>)}</div>}
            </div>
            <p className="expansion-message">{message}</p>
            <div className="expansion-controls">{config.steps.map((item, index) => <button key={item[1]} className={index < step ? 'complete' : index === step ? 'current' : ''} onClick={() => chooseStep(index)}><span>{index < step ? '✓' : item[0]}</span><b>{item[1]}</b></button>)}</div>
          </div>
          <aside className="game-instructions expansion-instructions"><span>{config.tile}任务</span><div className="instruction-emoji">{config.icon}</div><h3>搭建{config.name}</h3><ol><li><b>1</b>把小人放进对应颜色房间</li><li><b>2</b>按照发光提示完成任务</li><li><b>3</b>收下新的科室贴纸</li></ol><small>1000+ 种趣味病情组合</small></aside>
        </> : <DepartmentResultCard result={result} onComplete={() => onComplete(result)}/>}
      </section>
    </main>
  );
}

type PrintPack = 'quick' | 'prescription' | 'record' | 'building' | 'full';

function PaperHeader({ icon, title, subtitle, patient, page }: { icon: string; title: string; subtitle: string; patient: Patient; page: string }) {
  return <header className="paper-header"><div className="paper-hospital-mark">{icon}</div><div><small>咔嗒咔嗒积木医院 · {page}</small><h1>{title}</h1><p>{subtitle}</p></div><div className="paper-patient"><span>{patient.photoUrl ? <img src={patient.photoUrl} alt=""/> : '🧑‍🚀'}</span><b>{patient.name}</b><small>{patient.age} 岁</small></div></header>;
}

function QuickVisitPaper({ journey }: { journey: JourneyState }) {
  const route = journey.plannedRoute?.length ? journey.plannedRoute : buildTreatmentRoute(journey.patient.symptoms);
  return <section className="print-page quick-paper">
    <PaperHeader icon="🏥" title="我的积木医院冒险" subtitle="检查记录 + 画画任务 + 勇敢盖章" patient={journey.patient} page="本次就诊单"/>
    <div className="paper-info-strip"><span>📅 日期：{new Date().toLocaleDateString('zh-CN')}</span><span>🙂 今天：{journey.patient.symptoms.map((item) => symptomIcons[item]).join(' ') || '😊'}</span><span>🎫 路线：{route.length} 站</span></div>
    <h2 className="paper-section-title">🛗 今天的电梯路线</h2>
    <div className="paper-route" style={{ gridTemplateColumns: `repeat(${Math.min(route.length, 5)},1fr)` }}>{route.map((id, index) => { const dept = departmentCards.find((item) => item.id === id)!; const result = journey.results.find((item) => item.id === id); return <article key={id} className={result ? 'done' : ''}><i>{index + 1}</i><span>{dept.icon}</span><b>{dept.name}</b><small>{result ? `✓ ${result.summary}` : '○ 等待检查'}</small></article>; })}</div>
    <div className="paper-two-columns">
      <div className="paper-drawing-box"><b>✏️ 我哪里不舒服？</b><div className="body-doodle">🙂<i/><i/><i/><i/></div><small>可以画圈、涂颜色或贴贴纸</small></div>
      <div className="paper-note-box"><b>🔎 方块医生发现了</b>{journey.results.slice(0,4).map((result) => <p key={result.id}><span>{result.icon}</span>{result.summary}</p>)}<div className="writing-lines"><i/><i/><i/><i/></div></div>
    </div>
    <div className="paper-brave-row"><span>今天我最勇敢的是：</span><i/><i/><i/><b>医生盖章 ○</b></div>
    <footer className="paper-footer">这是亲子角色扮演游戏纸张，不是真正的医疗报告。真人不舒服时要马上告诉家长。</footer>
  </section>;
}

function PrescriptionPaper({ journey }: { journey: JourneyState }) {
  const collected = journey.results.flatMap((result) => result.prescription || []);
  const tasks = (collected.length ? collected : [
    { icon: '🥤', text: '慢慢喝一杯能量水', targetCount: 5 }, { icon: '🤗', text: '收集三个暖暖拥抱', targetCount: 3 },
    { icon: '🌬️', text: '做三次魔法深呼吸', targetCount: 5 }, { icon: '🌙', text: '在枕头基地好好充电', targetCount: 7 },
  ]).slice(0, 4);
  return <section className="print-page prescription-paper">
    <PaperHeader icon="⭐" title="快乐处方任务卡" subtitle="每完成一次，就亲手涂亮一颗星星" patient={journey.patient} page="纸上打卡游戏"/>
    <div className="paper-reminder">这里只记录喝水、休息、拥抱和游戏任务，不是真实药物剂量。</div>
    <div className="paper-task-list">{tasks.map((task, index) => <article key={`${task.text}-${index}`}><span>{task.icon}</span><div><small>快乐任务 {index + 1}</small><h2>{task.text}</h2><p>完成次数：</p><div className="task-circles">{Array.from({length: task.targetCount}).map((_, circle) => <i key={circle}>☆</i>)}</div></div><b>奖励<br/>贴纸区</b></article>)}</div>
    <div className="mood-week"><h2>😊 我的恢复表情</h2>{['第1天','第2天','第3天','第4天','第5天','第6天','第7天'].map((day) => <div key={day}><b>{day}</b><span>😄　🙂　😴　😣</span><i>圈一个</i></div>)}</div>
    <div className="paper-sign-row"><span>小医生签名：</span><i/><span>家长签名：</span><i/></div>
    <footer className="paper-footer">完成任务不是比赛，累了就休息。真实身体不舒服时请告诉家长。</footer>
  </section>;
}

function RecordDoodlePaper({ journey }: { journey: JourneyState }) {
  const prompt = journey.results.find((item) => item.drawPrompt)?.drawPrompt || '画出你在医院里最喜欢的房间';
  return <section className="print-page record-doodle-paper">
    <PaperHeader icon="📖" title="小医生手绘病历" subtitle="这张病历由小朋友自己完成" patient={journey.patient} page="病历记录页"/>
    <div className="record-prompts"><div><b>🌤️ 今天的天气</b><span>☀️　☁️　🌧️　❄️</span></div><div><b>😊 今天的心情</b><span>😄　🙂　😴　😣</span></div><div><b>🩺 我是小医生</b><span>名字：________________</span></div></div>
    <div className="big-drawing-space"><b>🎨 {prompt}</b><span>在这里画一大幅画</span><i/><i/><i/></div>
    <div className="record-bottom-grid"><div><b>💬 小患者告诉我</b><i/><i/><i/><i/></div><div><b>🔍 我检查发现</b><i/><i/><i/><i/></div></div>
    <div className="sticker-garden"><b>🏅 勇敢贴纸花园</b>{Array.from({length:6}).map((_, index) => <i key={index}>☆</i>)}</div>
    <footer className="paper-footer">病历编号：PLAY-{journey.journeyToken.slice(0,8).toUpperCase()}　·　纯游戏记录</footer>
  </section>;
}

function BuildingPosterPaper({ journey, part }: { journey: JourneyState; part: 'top' | 'bottom' }) {
  const floors = part === 'top' ? buildingFloors.slice(0, 3) : buildingFloors.slice(3);
  const visited = new Set(journey.results.map((item) => item.id));
  return <section className={`print-page building-poster-paper ${part}`}>
    <PaperHeader icon={part === 'top' ? '🚁' : '🚑'} title={part === 'top' ? '可放小人的医院大楼' : '医院大楼 · 欢迎大厅'} subtitle={part === 'top' ? '第 1 张：贴在第 2 张上方' : '第 2 张：与第 1 张沿虚线拼接'} patient={journey.patient} page="双页游戏垫"/>
    {part === 'bottom' && <div className="poster-join-line">✂ 拼接线：把第 1 张纸贴在这里 · ALIGN HERE</div>}
    <div className="paper-building">{floors.map((floor) => <div className="paper-floor" key={floor.floor}><strong>{floor.floor}F<small>{floor.name}</small></strong><div className="paper-room" style={{ '--paper-room': floor.rooms[0].color } as React.CSSProperties}><span>{floor.rooms[0].icon}</span><b>{floor.rooms[0].name}</b><i>{floor.rooms[0].departmentId && visited.has(floor.rooms[0].departmentId) ? '✓ 去过啦' : '盖章 ○'}</i></div><div className="paper-lift"><b>{floor.floor}</b><span>把小人<br/>放这里</span><i>⇅</i></div><div className="paper-room" style={{ '--paper-room': floor.rooms[1].color } as React.CSSProperties}><span>{floor.rooms[1].icon}</span><b>{floor.rooms[1].name}</b><i>{floor.rooms[1].departmentId && visited.has(floor.rooms[1].departmentId) ? '✓ 去过啦' : '盖章 ○'}</i></div></div>)}</div>
    {part === 'top' && <div className="poster-join-line">✂ 拼接线：把第 2 张纸接在这里 · ALIGN HERE</div>}
    {part === 'bottom' && <div className="paper-cutouts"><b>纸上小道具 · 可以涂色后剪下</b><span>🎫 电梯卡</span><span>👩‍⚕️ 医生牌</span><span>🚑 救护车</span><span>⭐ 勇敢星</span></div>}
    <footer className="paper-footer">可以直接把乐高小人平放在纸上乘电梯。需要剪纸时请让大人帮忙。</footer>
  </section>;
}

function PrintCenter({ journey, onBack }: { journey: JourneyState; onBack: () => void }) {
  const [pack, setPack] = useState<PrintPack>('full');
  const packs: Array<{ id: PrintPack; icon: string; title: string; description: string; pages: number }> = [
    { id: 'quick', icon: '📝', title: '一页就诊单', description: '路线、检查结果和画画区', pages: 1 },
    { id: 'prescription', icon: '⭐', title: '处方打卡表', description: '涂星星记录执行次数', pages: 1 },
    { id: 'record', icon: '🎨', title: '手绘病历页', description: '大空间写写画画', pages: 1 },
    { id: 'building', icon: '🏥', title: '大楼游戏垫', description: '两张 A4 拼接，可放小人', pages: 2 },
    { id: 'full', icon: '🎒', title: '完整纸上游戏包', description: '以上内容全部打印', pages: 5 },
  ];
  const pages = pack === 'quick' ? [<QuickVisitPaper key="quick" journey={journey}/>]
    : pack === 'prescription' ? [<PrescriptionPaper key="prescription" journey={journey}/>]
      : pack === 'record' ? [<RecordDoodlePaper key="record" journey={journey}/>]
        : pack === 'building' ? [<BuildingPosterPaper key="top" journey={journey} part="top"/>, <BuildingPosterPaper key="bottom" journey={journey} part="bottom"/>]
          : [<QuickVisitPaper key="quick" journey={journey}/>, <PrescriptionPaper key="prescription" journey={journey}/>, <RecordDoodlePaper key="record" journey={journey}/>, <BuildingPosterPaper key="top" journey={journey} part="top"/>, <BuildingPosterPaper key="bottom" journey={journey} part="bottom"/>];
  const current = packs.find((item) => item.id === pack)!;
  return <main className="app-shell hospital-shell print-center-page">
    <HospitalHeader room="纸上游戏打印中心 · 1F" color="#ef765b" onBack={onBack}/>
    <section className="print-center-screen">
      <div className="print-center-hero"><div><div className="eyebrow"><Printer size={17}/> PAPER PLAY LAB</div><h1>把积木医院<br/><em>带到纸上玩</em></h1><p>选择一份打印包，给小朋友留下画画、打卡、盖章和移动乐高小人的空间。</p></div><div className="printer-character">🖨️<span>纸张准备好啦！</span></div></div>
      <div className="print-pack-grid">{packs.map((item) => <button key={item.id} className={pack === item.id ? 'active' : ''} onClick={() => setPack(item.id)}><span>{item.icon}</span><div><small>{item.pages} 张 A4</small><h2>{item.title}</h2><p>{item.description}</p></div><i>{pack === item.id ? '✓' : '○'}</i></button>)}</div>
      <div className="print-launch-bar"><div><b>{current.icon} {current.title}</b><span>将打印 {current.pages} 页 · 建议开启“背景图形”</span></div><button onClick={() => window.print()}><Printer size={20}/>开始打印 {current.pages} 页</button></div>
      <div className="print-preview-label"><span>页面预览</span><p>下面显示实际纸张内容；打印时顶部控制区会自动隐藏。</p></div>
    </section>
    <div className="print-preview-stack">{pages}</div>
  </main>;
}

function DischargeCenter({ journey, onBack, onArchive, onNewVisit, onSwitch, archiving = false }: { journey: JourneyState; onBack: () => void; onArchive: () => Promise<void> | void; onNewVisit: () => void; onSwitch: () => void; archiving?: boolean }) {
  const plannedRoute = journey.plannedRoute?.length ? journey.plannedRoute : buildTreatmentRoute(journey.patient.symptoms);
  const routeResults = journey.results.filter((result) => plannedRoute.includes(result.id));
  const completed = routeResults.length;
  const routeComplete = completed === plannedRoute.length;
  const average = completed ? Math.round(routeResults.reduce((sum, result) => sum + result.score, 0) / completed) : 100;
  return (
    <main className="app-shell hospital-shell discharge-page">
      <HospitalHeader room="出院中心 · 07" color="#a474df" onBack={onBack}/>
      <section className="discharge-screen-head"><div><div className="eyebrow"><Trophy size={16}/> BRAVE PATIENT AWARD</div><h1>勇敢小患者<br/><em>出院中心</em></h1><p>所有科室的检查结果和贴纸，都装进这张纪念证书里。</p></div><div className="report-actions"><button onClick={() => window.print()}><Printer size={17}/> 打印 A4 证书</button>{journey.archivedVisitId ? <button className="finish-dept" onClick={onNewVisit}><RotateCcw size={17}/> 开始新就诊</button> : <button className="finish-dept" disabled={!routeComplete || archiving} onClick={onArchive}><BadgeCheck size={17}/>{archiving ? '正在归档…' : routeComplete ? '正式出院并安排回访' : `还差 ${plannedRoute.length - completed} 站`}</button>}<button onClick={onSwitch}><UserRound size={17}/> 换患者</button></div></section>
      <section className="report discharge-report">
        <div className="report-topline"/>
        <header className="report-header"><div className="report-title"><div className="report-seal purple"><Trophy size={28}/></div><div><span>咔嗒咔嗒积木医院 · 出院中心</span><h2>勇敢小患者出院证书</h2><p>BRAVE MINI PATIENT CERTIFICATE</p></div></div><div className="certificate-score"><strong>{average}</strong><span>综合能量</span></div></header>
        <div className="patient-strip"><div><span>患者姓名</span><b>{journey.patient.name}</b></div><div><span>积木年龄</span><b>{journey.patient.age} 岁</b></div><div><span>完成路线</span><b>{completed} / {plannedRoute.length}</b></div><div><span>症状表情</span><b>{journey.patient.symptoms.map((s) => symptomIcons[s]).join(' ')}</b></div><div><span>出院日期</span><b>{new Date().toLocaleDateString('zh-CN')}</b></div></div>
        <div className="discharge-report-body">
          <div className="certificate-hero"><span>🎖️</span><div><small>{journey.archivedVisitId ? '病历已经归档 · 回访任务已安排' : '医院正式宣布'}</small><h2>{journey.patient.name} 是一位非常勇敢的小患者！</h2><p>{routeComplete ? '今天的检查和配药路线都已完成，可以带着满满的能量回家啦。' : `已经完成 ${completed} 站，还可以回医院继续完成今日路线。`}</p></div></div>
          <div className="certificate-section-title"><span>🏥</span><div><h3>科室检查记录</h3><p>DEPARTMENT JOURNEY</p></div></div>
          <div className="journey-stamp-grid">
            {plannedRoute.map((id) => departmentCards.find((dept) => dept.id === id)!).map((dept) => {
              const result = journey.results.find((item) => item.id === dept.id);
              return <article key={dept.id} className={result ? 'completed' : 'pending'}><span>{result ? dept.icon : '○'}</span><div><small>{dept.name}</small><h4>{result ? result.summary : '等待检查'}</h4><p>{result ? result.detail : `下次可以用${dept.tile}搭建这里`}</p></div>{result && <b>{result.score}</b>}</article>;
            })}
          </div>
          <div className="certificate-lower-grid">
            <div><div className="certificate-section-title"><span>🎁</span><div><h3>获得的勇敢贴纸</h3><p>COLLECTED STICKERS</p></div></div><div className="certificate-stickers">{journey.results.map((result) => <span key={result.id}>{result.icon} {result.sticker}</span>)}{!completed && <span>🌟 第一次来医院奖</span>}</div></div>
            <aside className="discharge-care"><h3>🏠 回家快乐任务</h3><p>🤗 每天收集三个拥抱</p><p>🥤 记得慢慢喝水</p><p>🌙 睡前让勇气核心好好充电</p></aside>
          </div>
          <div className="certificate-signature"><div><span>出院医生</span><strong>咔嗒院长</strong></div><i>CLICK-CLACK<br/>APPROVED</i><div className="certificate-award"><Trophy size={20}/>超级勇敢积木小患者</div></div>
        </div>
        <footer className="report-footer"><ShieldCheck size={17}/><p><b>给大人的提醒：</b>这是亲子角色扮演游戏生成的纪念证书，不是真正的医疗诊断。真实身体不舒服时，请及时咨询医生。</p></footer>
      </section>
    </main>
  );
}

const previewPatient: Patient = { id: 'preview-patient', name: '小闪电', age: '6', symptoms: ['没精神'], photoUrl: '', photoBackground: 'rainbow', totalStickers: 4, visitCount: 1, pendingFollowUps: 3, lastVisitAt: null };
const defaultJourney: JourneyState = { ...createJourney(previewPatient), registered: false };
const dischargePreviewJourney: JourneyState = {
  patient: { ...previewPatient, symptoms: ['没精神', '肚子痛'] },
  registered: true,
  results: [
    { id: 'xray', name: 'X 光室', icon: '🩻', score: 91, summary: '彩虹能量轻微不足', detail: '积木骨架连接完整，彩虹能量休息后会重新亮起来。', sticker: 'X光探险家' },
    { id: 'heart', name: '心脏科', icon: '💓', score: 96, summary: '勇气核心节奏稳定', detail: '咚咚节奏整齐，勇气核心拥有很多暖暖粒子。', sticker: '心跳节奏大师' },
    { id: 'dental', name: '牙科', icon: '🦷', score: 94, summary: '糖果虫已经全部搬家', detail: '八颗牙齿都很坚固，泡泡牙刷完成清洁。', sticker: '刷牙小卫士' },
    { id: 'pharmacy', name: '彩虹药房', icon: '💊', score: 98, summary: '彩虹能量药已经配好', detail: '三种颜色装进药袋，快乐处方已经准备完成。', sticker: '彩虹配药小助手' },
    makeExpansionResult(expansionConfigs.orthopedics, previewPatient),
    makeExpansionResult(expansionConfigs.internal, previewPatient),
    makeExpansionResult(expansionConfigs.gastro, previewPatient),
    makeExpansionResult(expansionConfigs.surgery, previewPatient),
  ], plannedRoute: ['gastro', 'internal', 'heart', 'pharmacy'], journeyToken: 'preview-journey', startedAt: new Date().toISOString(), archivedVisitId: 'preview-visit',
};

function HospitalApp() {
  const params = new URLSearchParams(window.location.search);
  const isPrintPreview = params.get('mode') === 'print-preview';
  const isDischargePreview = params.get('mode') === 'discharge-preview';
  const isPaperPreview = params.get('mode') === 'paper-preview';
  const [route, setRoute] = useState('patients');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [journey, setJourney] = useState<JourneyState | null>(null);
  const [history, setHistory] = useState<HistoryResponse>({ visits: [], followUps: [], rewards: [] });
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const booted = useRef(false);

  const refreshPatients = async () => {
    const response = await clinicApi.bootstrap();
    const mapped = response.patients.map((item) => patientFromApi(item));
    setPatients(mapped);
    return mapped;
  };

  const selectPatient = async (patient: Patient, destination = 'lobby') => {
    setLoading(true);
    setServerError('');
    try {
      const [journeyResponse, historyResponse] = await Promise.all([clinicApi.getJourney<JourneyState>(patient.id), clinicApi.getHistory(patient.id)]);
      const activeJourney = journeyResponse.journey ? { ...journeyResponse.journey, patient: { ...patient, symptoms: journeyResponse.journey.patient?.symptoms || [] } } : createJourney(patient);
      setJourney(activeJourney);
      setHistory(historyResponse);
      setRoute(destination);
      window.localStorage.setItem('click-clack-selected-patient', patient.id);
      if (!journeyResponse.journey) await clinicApi.saveJourney(patient.id, activeJourney);
    } catch (error) { setServerError(error instanceof Error ? error.message : '病历读取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (booted.current || isPrintPreview || isDischargePreview || isPaperPreview) { setLoading(false); return; }
    booted.current = true;
    (async () => {
      try {
        let response = await clinicApi.bootstrap();
        if (!response.patients.length) {
          let oldJourney: unknown = null;
          try { oldJourney = JSON.parse(window.localStorage.getItem('click-clack-hospital-journey-v1') || 'null'); } catch {}
          const migration = await clinicApi.migrate(oldJourney);
          response = { patients: migration.patients, time: new Date().toISOString() };
        }
        const mapped = response.patients.map((item) => patientFromApi(item));
        setPatients(mapped);
        const savedId = window.localStorage.getItem('click-clack-selected-patient');
        const selected = mapped.find((item) => item.id === savedId);
        if (selected) await selectPatient(selected, 'lobby');
        else setLoading(false);
      } catch (error) { setServerError(error instanceof Error ? error.message : '无法连接积木医院数据库'); setLoading(false); }
    })();
  }, [isPrintPreview, isDischargePreview, isPaperPreview]);

  useEffect(() => {
    if (!journey?.patient.id || isPrintPreview || isDischargePreview || isPaperPreview) return;
    const timer = window.setTimeout(() => clinicApi.saveJourney(journey.patient.id, journey).catch(() => {}), 180);
    return () => window.clearTimeout(timer);
  }, [journey, isPrintPreview, isDischargePreview, isPaperPreview]);

  const completeDepartment = (result: DepartmentResult, nextPatient?: Patient) => {
    setJourney((current) => current ? ({ ...current, patient: nextPatient ?? current.patient, results: [...current.results.filter((item) => item.id !== result.id), result], archivedVisitId: undefined }) : current);
    setRoute('lobby');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const savePatient = async (draft: Patient, photoDataUrl: string) => {
    const apiPatient = draft.id
      ? await clinicApi.updatePatient(draft.id, { name: draft.name, age: draft.age, photoDataUrl: photoDataUrl || undefined, photoBackground: draft.photoBackground })
      : await clinicApi.createPatient({ name: draft.name, age: draft.age, photoDataUrl: photoDataUrl || undefined, photoBackground: draft.photoBackground });
    const patient = patientFromApi(apiPatient, draft.symptoms);
    const nextJourney = { ...(draft.id && journey ? journey : createJourney(patient)), patient, plannedRoute: buildTreatmentRoute(patient.symptoms), archivedVisitId: undefined };
    setJourney(nextJourney);
    await clinicApi.saveJourney(patient.id, nextJourney);
    await refreshPatients();
    setRoute('lobby');
    setLoading(false);
  };

  const archiveJourney = async () => {
    if (!journey || archiving) return;
    setArchiving(true);
    try {
      const xray = journey.results.find((item) => item.id === 'xray');
      const response = await clinicApi.archiveVisit({ patientId: journey.patient.id, journeyToken: journey.journeyToken, symptoms: journey.patient.symptoms, results: journey.results, diagnosisCode: xray?.summary || '', startedAt: journey.startedAt });
      const updatedPatient = patientFromApi(response.patient, journey.patient.symptoms);
      const updatedJourney = { ...journey, patient: updatedPatient, archivedVisitId: response.visitId };
      setJourney(updatedJourney);
      setHistory(response);
      await clinicApi.saveJourney(updatedPatient.id, updatedJourney);
      await refreshPatients();
    } finally { setArchiving(false); }
  };

  const newVisit = async () => {
    if (!journey) return;
    const next = { ...createJourney({ ...journey.patient, symptoms: [] }), plannedRoute: buildTreatmentRoute([]) };
    setJourney(next);
    setRoute('triage');
    await clinicApi.saveJourney(next.patient.id, next);
  };

  const completeFollowUp = async (followUp: FollowUpRecord, data: { energyLevel: number; mood: string; note?: string }) => {
    const response = await clinicApi.completeFollowUp(followUp.id, data);
    setHistory(response);
    if (journey) setJourney({ ...journey, patient: patientFromApi(response.patient, journey.patient.symptoms) });
    await refreshPatients();
  };

  if (isPrintPreview) return <XRayDepartment patient={defaultJourney.patient} onBack={() => {}} onComplete={() => {}}/>;
  if (isDischargePreview) return <DischargeCenter journey={dischargePreviewJourney} onBack={() => {}} onArchive={() => {}} onNewVisit={() => {}} onSwitch={() => {}}/>;
  if (isPaperPreview) return <PrintCenter journey={dischargePreviewJourney} onBack={() => {}}/>;
  if (loading) return <main className="app-shell hospital-shell"><HospitalHeader room="病历系统启动中"/><div className="hospital-loading"><span>🏥</span><h2>正在打开积木医院数据库…</h2><i/></div></main>;
  if (serverError) return <main className="app-shell hospital-shell"><HospitalHeader room="数据库未连接" color="#ff6a5b"/><div className="hospital-error"><span>🔌</span><h2>积木医院服务器没有连接</h2><p>{serverError}</p><code>请使用 npm run dev 启动完整医院</code><button onClick={() => window.location.reload()}>重新连接</button></div></main>;
  if (route === 'patients' || !journey) return <PatientWard patients={patients} onSelect={selectPatient} onNew={() => { setJourney(createJourney(emptyPatient())); setRoute('triage-new'); }}/>
  if (route === 'triage' || route === 'triage-new') return <TriageDesk patient={journey.patient} onBack={() => setRoute(route === 'triage-new' ? 'patients' : 'lobby')} onSave={savePatient}/>;
  if (route === 'records') return <PatientRecordBook patient={journey.patient} history={history} onBack={() => setRoute('lobby')} onFollowUps={() => setRoute('followups')}/>;
  if (route === 'followups') return <FollowUpCenter patient={journey.patient} history={history} onBack={() => setRoute('lobby')} onComplete={completeFollowUp}/>;
  if (route === 'print') return <PrintCenter journey={journey} onBack={() => setRoute('lobby')}/>;
  if (route === 'xray') return <XRayDepartment patient={journey.patient} onBack={() => setRoute('lobby')} onComplete={completeDepartment}/>;
  if (route === 'orthopedics') return <ExpansionDepartment id="orthopedics" patient={journey.patient} onBack={() => setRoute('lobby')} onComplete={completeDepartment}/>;
  if (route === 'internal') return <ExpansionDepartment id="internal" patient={journey.patient} onBack={() => setRoute('lobby')} onComplete={completeDepartment}/>;
  if (route === 'heart') return <HeartDepartment patient={journey.patient} onBack={() => setRoute('lobby')} onComplete={completeDepartment}/>;
  if (route === 'gastro') return <ExpansionDepartment id="gastro" patient={journey.patient} onBack={() => setRoute('lobby')} onComplete={completeDepartment}/>;
  if (route === 'surgery') return <ExpansionDepartment id="surgery" patient={journey.patient} onBack={() => setRoute('lobby')} onComplete={completeDepartment}/>;
  if (route === 'dental') return <DentalDepartment patient={journey.patient} onBack={() => setRoute('lobby')} onComplete={completeDepartment}/>;
  if (route === 'pharmacy') return <PharmacyDepartment patient={journey.patient} previousResults={journey.results} onBack={() => setRoute('lobby')} onComplete={completeDepartment}/>;
  if (route === 'discharge') return <DischargeCenter journey={journey} onBack={() => setRoute('lobby')} onArchive={archiveJourney} onNewVisit={newVisit} onSwitch={() => setRoute('patients')} archiving={archiving}/>;
  return <HospitalLobby journey={journey} history={history} onRoute={setRoute} onSwitch={() => setRoute('patients')}/>;
}

const rootElement = document.getElementById('root')!;
const browserWindow = window as typeof window & { __clickClackRoot?: ReturnType<typeof createRoot> };
const appRoot = browserWindow.__clickClackRoot ?? createRoot(rootElement);
browserWindow.__clickClackRoot = appRoot;
appRoot.render(<React.StrictMode><HospitalApp /></React.StrictMode>);
