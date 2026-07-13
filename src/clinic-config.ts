export type Symptom =
  | '没精神' | '肚子痛' | '走路咔嗒响' | '头晕晕' | '笑不出来' | '骨头松松的' | '外壳擦伤' | '肚肚咕噜' | '身体热热的'
  | '耳朵闷闷' | '鼻子痒痒' | '嗓子沙沙' | '眼睛累累' | '咳嗽泡泡' | '皮肤痒痒' | '动作慢慢' | '挑食没能量' | '心情有乌云';

export type DepartmentId =
  | 'xray' | 'orthopedics' | 'internal' | 'heart' | 'gastro' | 'surgery' | 'dental' | 'pharmacy'
  | 'ent' | 'ophthalmology' | 'respiratory' | 'dermatology'
  | 'ultrasound' | 'laboratory' | 'rehabilitation' | 'nutrition' | 'mood';

export type DepartmentKind = 'department' | 'support';

export type DepartmentDefinition = {
  id: DepartmentId;
  icon: string;
  name: string;
  subtitle: string;
  color: string;
  tile: string;
  description: string;
  childHint: string;
  floor: number;
  kind: DepartmentKind;
};

export const symptoms: Symptom[] = [
  '没精神', '肚子痛', '走路咔嗒响', '头晕晕', '笑不出来', '骨头松松的', '外壳擦伤', '肚肚咕噜', '身体热热的',
  '耳朵闷闷', '鼻子痒痒', '嗓子沙沙', '眼睛累累', '咳嗽泡泡', '皮肤痒痒', '动作慢慢', '挑食没能量', '心情有乌云',
];

export const symptomIcons: Record<Symptom, string> = {
  没精神: '😴', 肚子痛: '😣', 走路咔嗒响: '🦿', 头晕晕: '😵‍💫', 笑不出来: '☹️', 骨头松松的: '🦴', 外壳擦伤: '🩹', 肚肚咕噜: '🫧', 身体热热的: '🌡️',
  耳朵闷闷: '👂', 鼻子痒痒: '🤧', 嗓子沙沙: '🗣️', 眼睛累累: '👁️', 咳嗽泡泡: '🫁', 皮肤痒痒: '🧴', 动作慢慢: '🦿', 挑食没能量: '🥕', 心情有乌云: '🌧️',
};

export const departmentCards: DepartmentDefinition[] = [
  { id: 'xray', icon: '🩻', name: 'X 光室', subtitle: '骨骼扫描', color: '#24cfc6', tile: '蓝色磁力片', description: '看看积木骨架和能量核心', childHint: '看看积木骨架', floor: 2, kind: 'department' },
  { id: 'orthopedics', icon: '🦴', name: '骨科', subtitle: '骨骼工程', color: '#45a9df', tile: '浅蓝磁力片', description: '把骨骼积木放回正确位置', childHint: '拼好骨骼积木', floor: 2, kind: 'department' },
  { id: 'surgery', icon: '🩹', name: '积木外科', subtitle: '外壳维修', color: '#eb6687', tile: '粉色磁力片', description: '清洁、贴补丁、包好创可贴', childHint: '修好小小擦伤', floor: 2, kind: 'department' },
  { id: 'rehabilitation', icon: '🦿', name: '康复训练室', subtitle: '动作恢复', color: '#65a7b8', tile: '湖蓝磁力片', description: '跟着动作卡让小人慢慢恢复', childHint: '抽取动作卡', floor: 2, kind: 'support' },
  { id: 'heart', icon: '💓', name: '心脏科', subtitle: '心跳检查', color: '#ff6a5b', tile: '红色磁力片', description: '听一听勇气核心的咚咚节奏', childHint: '听咚咚心跳', floor: 3, kind: 'department' },
  { id: 'respiratory', icon: '🫁', name: '呼吸科', subtitle: '空气泡泡', color: '#4bb9c7', tile: '青色磁力片', description: '看空气泡泡进入左右肺', childHint: '送空气泡泡', floor: 3, kind: 'department' },
  { id: 'ultrasound', icon: '🔊', name: '超声波室', subtitle: '回声寻宝', color: '#607bd8', tile: '靛蓝磁力片', description: '用回声波寻找身体里的图案', childHint: '寻找回声宝藏', floor: 3, kind: 'support' },
  { id: 'laboratory', icon: '🧪', name: '能量化验室', subtitle: '颜色样本', color: '#31a78b', tile: '薄荷磁力片', description: '给想象能量样本排颜色队伍', childHint: '分析彩色样本', floor: 3, kind: 'support' },
  { id: 'internal', icon: '🩺', name: '能量内科', subtitle: '身体仪表', color: '#ef8b52', tile: '橙色磁力片', description: '检查温度、睡眠和呼吸泡泡', childHint: '调好身体仪表', floor: 4, kind: 'department' },
  { id: 'gastro', icon: '🫃', name: '肠胃科', subtitle: '肚肚列车', color: '#9a75d6', tile: '紫色磁力片', description: '帮食物列车通过肚肚迷宫', childHint: '开动肚肚列车', floor: 4, kind: 'department' },
  { id: 'nutrition', icon: '🥕', name: '营养工作室', subtitle: '能量餐盘', color: '#e59b32', tile: '蜜橙磁力片', description: '剪贴食物，搭配彩虹能量餐', childHint: '搭配能量餐盘', floor: 4, kind: 'support' },
  { id: 'pharmacy', icon: '🌈', name: '彩虹药房', subtitle: '想象能量处方', color: '#58b96a', tile: '绿色磁力片', description: '按处方装好三种想象能量', childHint: '配想象能量', floor: 4, kind: 'department' },
  { id: 'ent', icon: '👂', name: '耳鼻喉科', subtitle: '声音与空气', color: '#eb7969', tile: '珊瑚磁力片', description: '听声音、看空气、检查嗓音轨道', childHint: '追踪声音小火车', floor: 5, kind: 'department' },
  { id: 'ophthalmology', icon: '👁️', name: '眼科', subtitle: '星光聚焦', color: '#567dd0', tile: '宝蓝磁力片', description: '检查星光焦点和眨眼雨刷', childHint: '对准星光焦点', floor: 5, kind: 'department' },
  { id: 'dental', icon: '🦷', name: '牙科', subtitle: '糖果虫扫描', color: '#f5b82e', tile: '黄色磁力片', description: '找出藏在牙齿里的糖果虫', childHint: '赶走糖果虫', floor: 5, kind: 'department' },
  { id: 'dermatology', icon: '🧴', name: '皮肤科', subtitle: '外壳保护', color: '#ef8fac', tile: '桃粉磁力片', description: '检查外壳保护层和彩色斑点', childHint: '修补保护外壳', floor: 5, kind: 'department' },
  { id: 'mood', icon: '🌤️', name: '心情加油站', subtitle: '情绪天气', color: '#9a75c9', tile: '云朵磁力片', description: '画出心情天气，收集陪伴能量', childHint: '赶走心情乌云', floor: 6, kind: 'support' },
];

export function isDepartmentId(value: string): value is DepartmentId {
  return departmentCards.some((department) => department.id === value);
}

export function buildTreatmentRoute(selectedSymptoms: Symptom[]): DepartmentId[] {
  const selected = new Set(selectedSymptoms);
  const route: DepartmentId[] = [];
  const add = (...ids: DepartmentId[]) => ids.forEach((id) => { if (!route.includes(id)) route.push(id); });

  if (selected.has('走路咔嗒响') || selected.has('骨头松松的')) add('xray', 'orthopedics', 'rehabilitation');
  if (selected.has('外壳擦伤')) add('surgery', 'rehabilitation');
  if (selected.has('肚子痛') || selected.has('肚肚咕噜')) add('gastro', 'ultrasound', 'nutrition');
  if (selected.has('挑食没能量')) add('nutrition', 'gastro');
  if (selected.has('耳朵闷闷') || selected.has('鼻子痒痒') || selected.has('嗓子沙沙')) add('ent', 'laboratory');
  if (selected.has('眼睛累累')) add('ophthalmology');
  if (selected.has('咳嗽泡泡')) add('respiratory', 'ultrasound', 'internal');
  if (selected.has('皮肤痒痒')) add('dermatology', 'laboratory');
  if (selected.has('动作慢慢')) add('rehabilitation', 'orthopedics');
  if (selected.has('心情有乌云') || selected.has('笑不出来')) add('mood', 'heart');
  if (selected.has('没精神') || selected.has('头晕晕') || selected.has('身体热热的')) add('internal', 'heart');
  if (!route.length) add('xray');

  return [...route.slice(0, 4), 'pharmacy'];
}

export type BuildingRoom = {
  route: string;
  icon: string;
  name: string;
  childHint: string;
  color: string;
  departmentId?: DepartmentId;
};

const departmentRoom = (id: DepartmentId): BuildingRoom => {
  const department = departmentCards.find((item) => item.id === id)!;
  return { route: id, icon: department.icon, name: department.name, childHint: department.childHint, color: department.color, departmentId: id };
};

export const buildingFloors: Array<{ floor: number; name: string; rooms: BuildingRoom[] }> = [
  { floor: 6, name: '康复纪念层', rooms: [
    { route: 'discharge', icon: '🎖️', name: '出院中心', childHint: '领勇敢证书', color: '#9b6bd1' },
    { route: 'followups', icon: '☎️', name: '回访中心', childHint: '记录恢复故事', color: '#ef765b' },
    departmentRoom('mood'),
  ] },
  { floor: 5, name: '五官检查层', rooms: [departmentRoom('ent'), departmentRoom('ophthalmology'), departmentRoom('dental'), departmentRoom('dermatology')] },
  { floor: 4, name: '身体能量层', rooms: [departmentRoom('internal'), departmentRoom('gastro'), departmentRoom('nutrition'), departmentRoom('pharmacy')] },
  { floor: 3, name: '声音影像层', rooms: [departmentRoom('heart'), departmentRoom('respiratory'), departmentRoom('ultrasound'), departmentRoom('laboratory')] },
  { floor: 2, name: '积木修理层', rooms: [departmentRoom('xray'), departmentRoom('orthopedics'), departmentRoom('surgery'), departmentRoom('rehabilitation')] },
  { floor: 1, name: '欢迎大厅', rooms: [
    { route: 'triage', icon: '👩‍⚕️', name: '挂号台', childHint: '告诉护士哪里不舒服', color: '#ffca28' },
    { route: 'records', icon: '📖', name: '病历室', childHint: '翻翻照片病历', color: '#4aa89a' },
    { route: 'print', icon: '🖨️', name: '打印工坊', childHint: '领取纸上游戏', color: '#ef765b' },
  ] },
];
