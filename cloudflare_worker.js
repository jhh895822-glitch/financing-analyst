// 融资分析师 Cloudflare Worker v4.0
// 基于128条产品的真实准入规则匹配
// 环境变量: DEEPSEEK_API_KEY, AIRTABLE_TOKEN, AIRTABLE_BASE_ID

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors();
    if (request.method !== 'POST') return resp({error:'Method not allowed'}, 405);
    try {
      const body = await request.json();
      if (body['自定义产品']) {
        try {
          const customProds = JSON.parse(body['自定义产品']);
          customProds.forEach(cp => {
            products.push({
              '产品名称': cp['产品名称']||'',
              '所属银行': cp['所属银行']||'',
              '产品类型': cp['产品类型']||'信用贷',
              '额度上限(万)': cp['额度上限']||'300',
              '额度下限(万)': '1',
              '利率下限(%)': (cp['利率范围']||'').match(/[\d.]+/)?.[0]||'5',
              '利率上限(%)': (cp['利率范围']||'').match(/[\d.]+$/)?.[0]||'8',
              '期限(月)': cp['期限']||'12',
              '申请渠道': cp['申请渠道']||'线下',
              '法人类别': cp['法人类别']||'有限公司+个体户',
              '征信要求': cp['征信要求']||'征信良好',
              '负债要求': '负债率≤70%',
              '核心公式': cp['核心公式']||'',
              '行业偏好': '全行业',
              '最低纳税(万)': '0',
              '最低开票(万)': '0',
              '备注': cp['备注']||'自定义产品',
            });
          });
        } catch(e) {}
      }
      const engine = runEngine(body, products);
      const ai = await callDeepSeek(engine.prompt, env);
      saveAirtable(body, engine, ai, env);
      return resp({ success: true, scores: engine.scores, avgRisk: engine.avgRisk, fraud: engine.fraud, remedy: engine.remedy, top8: engine.top8, combinations: engine.combinations, channelAdvice: engine.channelAdvice, ...ai });
    } catch(e) {
      return resp({error: e.message}, 500);
    }
  }
};

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const cors = () => new Response(null, {status:204, headers:CORS});
const resp = (data, s=200) => new Response(JSON.stringify(data), {status:s, headers:{...CORS,'Content-Type':'application/json'}});

const products = [{"产品ID":"P_CCB_001","产品名称":"信用快贷","所属银行":"建设银行","产品类型":"信用贷","额度上限(万)":"300","额度下限(万)":"1","利率下限(%)":"3.0","利率上限(%)":"4.5","期限(月)":"12","还款方式":"先息后本/随借随还","行业偏好":"全行业","最低纳税(万)":"0","最低开票(万)":"0","征信要求":"近2年无连三累六，信用卡使用率≤70%，近3个月查询≤4次","负债要求":"负债率≤70%","申请渠道":"纯线上","法人类别":"有限公司+个体户","特色标签":"建行存量客户","核心公式":"基于建行金融资产（AUM值）授信","备注":"建行惠懂你系列；全线上申请；最快1分钟放款"},{"产品ID":"P_CCB_002","产品名称":"云税贷","所属银行":"建设银行","产品类型":"税贷","额度上限(万)":"500","额度下限(万)":"1","利率下限(%)":"3.5","利率上限(%)":"4.5","期限(月)":"12","还款方式":"先息后本/随借随还","行业偏好":"全行业","最低纳税(万)":"0.5","最低开票(万)":"0","征信要求":"纳税≥12个月，纳税评级A/B/M级，年纳税≥5000元，经营≥2年","负债要求":"负债率≤70%","申请渠道":"纯线上","法人类别":"有限公司","特色标签":"以税授信","核心公式":"年纳税×8-15倍；可叠加发票提额","备注":"惠懂你系列；需开建行对公户并开通企业网银"},{"产品ID":"P_CCB_003","产品名称":"首户快贷","所属银行":"建设银行","产品类型":"信用贷","额度上限(万)":"100","额度下限(万)":"1","利率下限(%)":"3.4","利率上限(%)":"4.5","期限(月)":"12","还款方式":"先息后本/随借随还","行业偏好":"全行业","最低纳税(万)":"0","最低开票(万)":"0","征信要求":"征信良好无当前逾期，近2年无连三累六","负债要求":"负债率≤70%","申请渠道":"纯线上","法人类别":"有限公司+个体户","特色标签":"新企业专属","核心公式":"成立≥6个月，首次银行融资","备注":"惠懂你系列；新企业门槛极低"},{"产品ID":"P_CCB_004","产品名称":"商户云贷","所属银行":"建设银行","产品类型":"流水贷","额度上限(万)":"300","额度下限(万)":"1","利率下限(%)":"3.3","利率上限(%)":"4.5","期限(月)":"12","还款方式":"先息后本/随借随还","行业偏好":"全行业","最低纳税(万)":"0","最低开票(万)":"0","征信要求":"征信无当前逾期，近2年无连三累六，近3个月查询≤6次","负债要求":"按公式计算","申请渠道":"纯线上","法人类别":"个体户为主","特色标签":"银联/微信/支付宝流水","核心公式":"银联码流水×30%-负债；支持微信/支付宝授权","备注":"惠懂你系列；收款码流水≥6个月；个体户最优"},{"产品ID":"P_ICBC_001","产品名称":"经营快贷","所属银行":"工商银行","产品类型":"信用贷","额度上限(万)":"500","额度下限(万)":"1","利率下限(%)":"3.0","利率上限(%)":"5.5","期限(月)":"12","还款方式":"先息后本/随借随还","行业偏好":"全行业","最低纳税(万)":"0","最低开票(万)":"0","征信要求":"征信无连三累六，半年查询≤15次，无当前逾期","负债要求":"负债率≤70%","申请渠道":"纯线上+线下增信","法人类别":"有限公司+个体户","特色标签":"工银普惠首选","核心公式":"五大通道：结算/税务/商户/资产/泛交易链","备注":"≤50万纯线上直批；支持微信/支付宝流水授权"},{"产品ID":"P_ABC_001","产品名称":"纳税e贷","所属银行":"农业银行","产品类型":"税贷","额度上限(万)":"300","额度下限(万)":"1","利率下限(%)":"3.1","利率上限(%)":"4.5","期限(月)":"12","还款方式":"先息后本/随借随还","行业偏好":"全行业","最低纳税(万)":"1","最低开票(万)":"0","征信要求":"纳税评级A/B/M级，近12个月纳税≥1万元，成立≥2年，征信近2年无连三累六","负债要求":"其他银行授信≤2家，信贷余额≤500万（房贷除外）","申请渠道":"纯线上","法人类别":"有限公司","特色标签":"以税定贷","核心公式":"年纳税×倍数；A级纳税企业利率可低至2.45%","备注":"农行微捷贷系列；微信搜索普惠e站小程序申请"},{"产品ID":"P_ABC_002","产品名称":"商户e贷","所属银行":"农业银行","产品类型":"流水贷","额度上限(万)":"300","额度下限(万)":"1","利率下限(%)":"3.1","利率上限(%)":"4.5","期限(月)":"36","还款方式":"先息后本","行业偏好":"全行业","最低纳税(万)":"0","最低开票(万)":"0","征信要求":"征信近2年无连三累六，近3个月查询≤8次，无当前逾期","负债要求":"无明确负债上限","申请渠道":"纯线上","法人类别":"个体户为主","特色标签":"银联/农行收款码","核心公式":"收款码流水×30%-负债；优质商户可达1000万","备注":"农行惠农e贷系列；营业执照满1-2年，银联码连续使用6个月以上"},{"产品ID":"P_CQRCB_001","产品名称":"小微企业便捷贷","所属银行":"重庆农商行","产品类型":"综合贷","额度上限(万)":"2000","额度下限(万)":"10","利率下限(%)":"市场化定价","利率上限(%)":"市场化定价","期限(月)":"36","还款方式":"先息后本/等额本息","行业偏好":"全行业","最低纳税(万)":"0","最低开票(万)":"0","征信要求":"征信良好","负债要求":"按具体产品","申请渠道":"线下","法人类别":"企事业法人","特色标签":"额度循环","核心公式":"综合评估，一次授信循环支用","备注":"渝农商行拳头产品"},{"产品ID":"P_GUAR_001","产品名称":"担保过渡贷","所属银行":"重庆担保公司","产品类型":"过渡贷","额度上限(万)":"200","额度下限(万)":"1","利率下限(%)":"12.0","利率上限(%)":"18.0","期限(月)":"24","还款方式":"按月付息","行业偏好":"全行业","最低纳税(万)":"0","最低开票(万)":"0","征信要求":"无多笔逾期，银行条件暂时不足","负债要求":"不限","申请渠道":"线下","法人类别":"有限公司+个体户","特色标签":"应急周转","核心公式":"银行拒贷后过渡","备注":"短期应急后转银行低息产品；利率远高于银行"}];

const num = v => parseFloat(v)||0;

function inferType(p) {
  const t = p['产品类型']||'';
  if (t && t!=='其他') return t;
  const n = p['产品名称']||'';
  if (n.match(/税贷|云税|纳税e贷/)) return '税贷';
  if (n.match(/商户|收款码|商户云贷|商户e贷/)) return '流水贷';
  if (n.match(/抵押|e抵/)) return '抵押贷';
  if (n.match(/流水|结算云贷/)) return '流水贷';
  if (n.match(/科技|专精|善科|善新|科创/)) return '科技贷';
  if (n.match(/供应链|链捷|政采/)) return '供应链金融';
  if (n.match(/担保|过渡/)) return '过渡贷';
  if (n.match(/涉农|花椒|脆李|榨菜|生猪|富农|裕农|惠农/)) return '涉农贷';
  if (n.match(/创业担保|贴息/)) return '政策性贷';
  if (n.match(/消费|安逸花/)) return '消费贷';
  if (n.match(/外贸|跨境/)) return '贸易贷';
  if (n.match(/置换/)) return '置换贷';
  return '信用贷';
}

function checkProductEligibility(p, rec) {
  const creditReq = p['征信要求']||'';
  const debtReq   = p['负债要求']||'';
  const formula   = p['核心公式']||'';
  const lt        = p['法人类别']||'';
  const pref      = p['行业偏好']||'全行业';
  const minTax    = num(p['最低纳税(万)']);
  const minInv    = num(p['最低开票(万)']);
  const maxAmt    = num(p['额度上限(万)'])||500;
  const type      = inferType(p);

  const BLACK_INDS = ['娱乐','夜总会','KTV','洗浴','棋牌','赌博','典当','小贷公司','P2P','采矿'];
  if (BLACK_INDS.some(b => rec.ind.includes(b)) && type !== '过渡贷' && type !== '担保贷') return null;

  if (lt==='有限公司' && rec.isGeti) return null;
  if (lt==='个体户' && !rec.isGeti) return null;
  if (pref!=='全行业') {
    const prefs = pref.split('/');
    if (!prefs.some(pp => rec.ind.includes(pp))) return null;
  }
  if (minTax > 0 && rec.tax < minTax) return null;
  if (minInv > 0 && rec.inv < minInv) return null;
  if (creditReq.match(/无当前逾期|无逾期/) && rec.hasCurrentOverdue) return null;
  if (type==='抵押贷' && !rec.hasMortgage) return null;

  let theoretical = 0;
  const isQR = !!(p['产品名称']||'').match(/商户云贷|商户e贷|收款码|个体经营快贷/);
  if (isQR && !rec.isGeti && rec.qr < 5) return null;
  if (isQR) {
    const ratio = (p['所属银行']||'').includes('建设') ? 0.40 : 0.30;
    theoretical = Math.min(maxAmt, rec.qr * 12 * ratio);
  } else if (type==='税贷') {
    theoretical = Math.min(maxAmt, rec.tax * 10);
  } else if (type==='流水贷') {
    theoretical = Math.min(maxAmt, rec.cf * 3);
  } else if (type==='抵押贷') {
    theoretical = Math.min(maxAmt, rec.hasMortgage ? 500 : 0);
  } else {
    theoretical = Math.min(maxAmt, Math.max(rec.tax*8, rec.cf*3, 50));
  }

  const available = Math.max(0, theoretical - rec.debt);
  if (available < 10 && type !== '过渡贷' && type !== '政策性贷') return null;

  const passProb = rec.hasCurrentOverdue ? 5 :
    Math.min(95, 60 + (available > rec.need ? 20 : 0) + (rec.tax > 10 ? 10 : 0) + (rec.cf > 20 ? 10 : 0));

  return {
    name: p['产品名称'], bank: p['所属银行'], type,
    estAmt: Math.round(Math.min(available, rec.need)),
    theoretical: Math.round(theoretical), available: Math.round(available),
    debtNote: `理论${Math.round(theoretical)}万-负债${rec.debt}万`,
    rateLower: num(p['利率下限(%)']), rateUpper: num(p['利率上限(%)']),
    term: num(p['期限(月)']), channel: p['申请渠道'],
    passProb, matchScore: passProb + (available > rec.need ? 20 : available/rec.need*20),
    creditReq, debtReq, formula, remark: p['备注']||'',
  };
}

function runEngine(body, products) {
  const inv  = num(body['年开票万']);
  const tax  = num(body['年纳税万']);
  const cf   = num(body['月均对公流水万']);
  const debt = num(body['现有负债万']);
  const need = num(body['需求金额万']);
  const qr   = num(body['月均银联收款码流水万']);
  const wx   = num(body['月均微信支付宝流水万']);
  const yrs  = num(body['成立年限']);
  const assets = num(body['总资产万']) || num(body['房产评估值万']);
  const q3   = num(body['近3月查询次数']);
  const loanOrgs = num(body['现有贷款机构数']);
  const overdueCount = num(body['近2年逾期次数']);
  const cardUsage = num(body['信用卡使用率']);
  const loanCount = num(body['当前贷款笔数']);
  const isGeti = (body['企业类型']||'有限公司').includes('个体');
  const hasCurrentOverdue = !!(body['法人征信']||'').match(/当前逾期|未结清逾期/);
  const hasMortgage = !!(body['抵押情况']||'').match(/房产|住宅|商铺|写字楼|厂房/);
  const ind  = body['行业']||'其他';
  const taxRateNum = (inv>0 ? tax/inv*100 : 0);
  const taxRate = taxRateNum.toFixed(2);
  const taxGrade = isGeti ? '' : (body['纳税等级']||'');
  const biz  = body['企业类型']||'有限公司';
  const credit = body['法人征信']||'无逾期';
  const mort = body['抵押情况']||'无';
  const special = body['特殊资质']||'';
  const remark = body['备注']||'';
  const region = body['地区']||'重庆主城';
  const debtDetail = body['负债明细']||'';
  const debtType = body['负债类型']||'';
  const targetBank = body['目标银行']||'';
  const aum = num(body['行内AUM万']);
  const existClient = body['存量客户']||'否';
  const flowStab = body['流水连续性']||'每月稳定';
  const flowTrend = body['流水趋势']||'稳定';
  const flowSource = body['流水主要来源']||'经营收款';
  const qrMonths = body['收款码使用月数']||'';

  const scores = {
    credit: hasCurrentOverdue ? 0 : Math.max(0, 100 - overdueCount*15 - (q3>=6?20:q3>=4?10:0) - (cardUsage>80?15:cardUsage>70?5:0)),
    debt: Math.max(0, 100 - (debt/(need||100))*30 - loanOrgs*10),
    flow: Math.min(100, (cf*12 + qr*12*0.3)*100/(need*6||1)),
    tax: isGeti ? 70 : Math.min(100, tax/Math.max(need*0.1,1)*100),
    asset: hasMortgage ? Math.min(100, assets/(need||1)*50) : 30,
    biz: Math.min(100, yrs*20 + (special?20:0)),
  };
  const avgRisk = Math.round(Object.values(scores).reduce((a,b)=>a+b,0)/6);

  const fraud = { riskScore: 0, reasons: [] };
  if (q3 >= 8) { fraud.riskScore += 30; fraud.reasons.push(`近3月查询${q3}次过多`); }
  if (loanOrgs >= 5) { fraud.riskScore += 20; fraud.reasons.push(`贷款机构${loanOrgs}家偏多`); }
  if (!!(body['负债类型']||'').match(/网贷|消费贷/)) { fraud.riskScore += 10; fraud.reasons.push('有网贷记录'); }

  const rec = { inv, tax, cf, debt, need, hasMortgage, hasCurrentOverdue, isGeti, qr, wx, loanOrgs, ind, region, yrs };

  const matched = [];
  for (const p of products) {
    const result = checkProductEligibility(p, rec);
    if (result) matched.push(result);
  }
  matched.sort((a,b) => b.matchScore - a.matchScore);
  const top8 = matched.slice(0,8);

  const combinations = [];
  if (top8.length >= 2) {
    const qrProd = top8.find(p => p.type==='流水贷');
    const cProd  = top8.find(p => p.type==='信用贷' || p.type==='税贷');
    if (qrProd && cProd && qrProd.name !== cProd.name) {
      combinations.push({ desc:`${qrProd.name}(${qrProd.estAmt}万)+${cProd.name}(${cProd.estAmt}万)=合计${qrProd.estAmt+cProd.estAmt}万`, note:'先申收款码产品，成功后再叠加信用贷', totalAmt: qrProd.estAmt+cProd.estAmt });
    }
  }

  if (top8.length === 0) top8.push({ name:'担保公司过渡融资', bank:'重庆各担保公司', type:'过渡贷', estAmt:Math.min(150,need), theoretical:150, available:150, debtNote:'不受负债额度限制', rateLower:12, rateUpper:18, term:24, channel:'线下', passProb:65, matchScore:30, creditReq:'无多笔逾期', debtReq:'不限', remark:'短期过渡后转银行低息产品' });

  const isCounty = !!(region && !region.match(/渝北|江北|南岸|九龙坡|沙坪坝|渝中|大渡口|北碚|巴南|主城|两江|高新/));
  const channelAdvice = hasCurrentOverdue
    ? '当前有逾期未结清，必须先解决逾期问题，建议联系征信修复机构同时考虑担保公司过渡。'
    : isGeti && qr >= 10
      ? `个体户月均银联码流水${qr}万，首选线上申请商户云贷/商户e贷，无需对公账户最快1天放款。`
      : matched.length >= 3
        ? '资质基本达标，优先尝试线上产品，按匹配排序依次申请成功后再叠加其他产品。'
        : '线上产品匹配较少，建议预约渝农商行/农行普惠金融部门线下面谈。';

  const remedy = [];
  if (hasCurrentOverdue) remedy.push('• 【最优先】结清当前逾期，否则所有银行产品无法申请');
  if (!isGeti && scores.tax < 55) remedy.push(`• 连续足额纳税12个月，目标年纳税≥5万，提升纳税等级至M级以上`);
  if (isGeti && qr < 10) remedy.push(`• 增加银联码收款，月均目标≥${Math.round(need/12/0.35)}万，持续6个月以上`);
  if (!isGeti && scores.flow < 55) remedy.push(`• 集中走对公账户流水，持续3个月，月均目标≥${Math.round(need/6)}万`);
  if (scores.debt < 55) remedy.push('• 结清部分小额贷款，减少贷款机构数量，降低负债总额');
  if (q3 >= 4) remedy.push('• 停止申请新贷款3个月，让查询次数自然淡化');
  if (remedy.length === 0) remedy.push('• 综合资质良好，直接按推荐产品申请');

  const prodListStr = top8.map((p,i) => `${i+1}.【${p.name}】${p.bank}|类型:${p.type}|可贷${p.estAmt}万|利率${p.rateLower}%-${p.rateUpper}%|期限${p.term}月|渠道:${p.channel}|通过率:${p.passProb}%`).join('\n');
  const prompt = `你是重庆专业助贷顾问，只返回JSON不加其他文字。\n客户:${body['企业名称']||'未填'}|${biz}|${ind}|成立${yrs}年|年税${tax}万|月流水${cf}万|月银联${qr}万|负债${debt}万|需求${need}万|征信:${credit}|逾期${overdueCount}次|查询${q3}次|综合评分${avgRisk}\n产品列表:\n${prodListStr}\n返回JSON:{"profile":"企业画像","difficulty":"容易/一般/较难/困难","difficulty_reason":"原因","channel_advice":"渠道建议","products":[{"name":"产品名","bank":"银行","why":"理由","key_risk":"风险","success_rate":"高/中/低","negotiation_tip":"话术"}],"remedy_advice":"提升建议","path":[{"title":"本周行动","desc":"动作"},{"title":"材料清单","desc":"材料"},{"title":"长期提升","desc":"建议"}],"advice":"综合判断"}`;

  return { scores, avgRisk, fraud, remedy: remedy.join('\n'), top8, combinations, channelAdvice, prompt };
}

async function callDeepSeek(prompt, env) {
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.DEEPSEEK_API_KEY}`},
      body: JSON.stringify({ model:'deepseek-chat', max_tokens:3000, temperature:0.2, messages:[{role:'system',content:'专业助贷顾问，只返回JSON'},{role:'user',content:prompt}] })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content||'{}';
    return JSON.parse(text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim());
  } catch(e) {
    return { profile:'AI分析暂时不可用', advice:'请检查DEEPSEEK_API_KEY配置', products:[], path:[], remedy_advice:'' };
  }
}

async function saveAirtable(body, engine, ai, env) {
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) return;
  const top = engine.top8[0]||{};
  try {
    await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/loan_cases`, {
      method:'POST',
      headers:{'Authorization':`Bearer ${env.AIRTABLE_TOKEN}`,'Content-Type':'application/json'},
      body: JSON.stringify({ fields: { '企业名称':body['企业名称']||'', '行业':body['行业']||'', '融资需求(万)':num(body['需求金额万']), '综合评分':engine.avgRisk, '首选产品':top.name||'', '预计额度':top.estAmt?`${top.estAmt}万`:'', '通过概率':top.passProb||0, '企业画像':ai.profile||'', '顾问建议':ai.advice||'', '提交时间':new Date().toISOString() }})
    });
  } catch(e) {}
}
