/*
 * TET preparation corner: original practice questions on Child Development & Pedagogy (the section common to
 * CTET and state TETs), and a short note on the CTET pattern. Exam rules change: the pattern is marked
 * VERIFY in docs/VERIFY_BEFORE_LAUNCH.md and the page always sends readers to the official website.
 */
import type { L } from './interviewPrep';

export interface PracticeQuestion { id: string; topic: L; q: L; options: L[]; answer: number; why: L }

const o = (en: string, hi: string): L => ({ en, hi });

export const PRACTICE: PracticeQuestion[] = [
  { id: 'q1', topic: o('Policy', 'नीति'), q: o('The Right of Children to Free and Compulsory Education Act, 2009 covers children of which age group?', 'नि:शुल्क और अनिवार्य बाल शिक्षा का अधिकार अधिनियम, 2009 किस आयु वर्ग के बच्चों पर लागू होता है?'),
    options: [o('3 to 10 years', '3 से 10 वर्ष'), o('6 to 14 years', '6 से 14 वर्ष'), o('5 to 15 years', '5 से 15 वर्ष'), o('6 to 18 years', '6 से 18 वर्ष')], answer: 1,
    why: o('The RTE Act guarantees free and compulsory elementary education to every child from 6 to 14 years of age.', 'आरटीई अधिनियम 6 से 14 वर्ष के हर बच्चे को नि:शुल्क और अनिवार्य प्रारंभिक शिक्षा की गारंटी देता है।') },
  { id: 'q2', topic: o('Development', 'विकास'), q: o('According to Piaget, in which stage do children begin to think logically about concrete objects and events?', 'पियाजे के अनुसार किस अवस्था में बच्चे ठोस वस्तुओं और घटनाओं के बारे में तार्किक रूप से सोचने लगते हैं?'),
    options: [o('Sensorimotor', 'संवेदी-गामक'), o('Pre-operational', 'पूर्व-संक्रियात्मक'), o('Concrete operational', 'मूर्त संक्रियात्मक'), o('Formal operational', 'औपचारिक संक्रियात्मक')], answer: 2,
    why: o('In the concrete operational stage (about 7 to 11 years) children reason logically about things they can see and handle; abstract reasoning comes later.', 'मूर्त संक्रियात्मक अवस्था (लगभग 7 से 11 वर्ष) में बच्चे दिखने और छूने वाली चीज़ों के बारे में तर्क करते हैं; अमूर्त चिंतन बाद में आता है।') },
  { id: 'q3', topic: o('Learning', 'अधिगम'), q: o('The gap between what a child can do alone and what the child can do with help is called…', 'बच्चा अकेले क्या कर सकता है और मदद से क्या कर सकता है, इनके बीच के अंतर को कहते हैं…'),
    options: [o('Zone of proximal development', 'समीपस्थ विकास का क्षेत्र'), o('Conditioning', 'अनुबंधन'), o('Assimilation', 'आत्मसात्करण'), o('Readiness', 'तत्परता')], answer: 0,
    why: o('Vygotsky called it the zone of proximal development; teaching works best inside this zone.', 'वायगोत्स्की ने इसे समीपस्थ विकास का क्षेत्र कहा; इसी क्षेत्र में शिक्षण सबसे प्रभावी होता है।') },
  { id: 'q4', topic: o('Learning', 'अधिगम'), q: o('A teacher gives a lot of support at first and slowly withdraws it as the child becomes able. This is…', 'शिक्षक पहले बहुत सहायता देता है और बच्चे के सक्षम होने पर धीरे-धीरे उसे हटा लेता है। यह है…'),
    options: [o('Rote learning', 'रटकर सीखना'), o('Scaffolding', 'पाड़ (स्कैफ़ोल्डिंग)'), o('Punishment', 'दंड'), o('Streaming', 'स्ट्रीमिंग')], answer: 1,
    why: o('Scaffolding is temporary support that is reduced as the learner gains independence.', 'स्कैफ़ोल्डिंग अस्थायी सहायता है जिसे सीखने वाले के आत्मनिर्भर होने पर कम किया जाता है।') },
  { id: 'q5', topic: o('Assessment', 'आकलन'), q: o('The main purpose of formative assessment is to…', 'रचनात्मक आकलन का मुख्य उद्देश्य है…'),
    options: [o('rank children', 'बच्चों को श्रेणी देना'), o('decide promotion', 'कक्षोन्नति तय करना'), o('improve teaching and learning while it is happening', 'चलते हुए शिक्षण और अधिगम में सुधार करना'), o('report to parents once a year', 'साल में एक बार अभिभावकों को बताना')], answer: 2,
    why: o('Formative assessment is assessment for learning: it gives feedback during the process so both teacher and child can adjust.', 'रचनात्मक आकलन सीखने के लिए आकलन है: यह प्रक्रिया के दौरान फीडबैक देता है ताकि शिक्षक और बच्चा दोनों सुधार कर सकें।') },
  { id: 'q6', topic: o('Policy', 'नीति'), q: o('The school structure proposed by the National Education Policy 2020 is…', 'राष्ट्रीय शिक्षा नीति 2020 द्वारा प्रस्तावित विद्यालयी संरचना है…'),
    options: [o('10+2', '10+2'), o('5+3+3+4', '5+3+3+4'), o('4+4+4', '4+4+4'), o('8+4', '8+4')], answer: 1,
    why: o('NEP 2020 replaces 10+2 with 5+3+3+4: foundational, preparatory, middle and secondary stages.', 'एनईपी 2020 ने 10+2 के स्थान पर 5+3+3+4 संरचना दी: बुनियादी, प्रारंभिक, मध्य और माध्यमिक चरण।') },
  { id: 'q7', topic: o('Inclusion', 'समावेशन'), q: o('Inclusive education means…', 'समावेशी शिक्षा का अर्थ है…'),
    options: [o('separate schools for children with disabilities', 'दिव्यांग बच्चों के लिए अलग विद्यालय'), o('all children, including those with disabilities, learning together in regular schools', 'दिव्यांग बच्चों सहित सभी बच्चे सामान्य विद्यालयों में साथ-साथ सीखें'), o('admitting only high scorers', 'केवल अधिक अंक वालों को प्रवेश'), o('teaching only in English', 'केवल अंग्रेज़ी में पढ़ाना')], answer: 1,
    why: o('Inclusion adapts the regular classroom so that every child can learn in it, with support where needed.', 'समावेशन सामान्य कक्षा को इस तरह ढालता है कि ज़रूरत के अनुसार सहायता के साथ हर बच्चा उसमें सीख सके।') },
  { id: 'q8', topic: o('Development', 'विकास'), q: o('The theory of multiple intelligences was given by…', 'बहु-बुद्धि का सिद्धांत किसने दिया?'),
    options: [o('Howard Gardner', 'हावर्ड गार्डनर'), o('B. F. Skinner', 'बी. एफ़. स्किनर'), o('Lawrence Kohlberg', 'लॉरेंस कोलबर्ग'), o('Ivan Pavlov', 'इवान पावलोव')], answer: 0,
    why: o('Howard Gardner proposed that intelligence has several forms (linguistic, logical-mathematical, spatial, musical, bodily-kinaesthetic and others).', 'हावर्ड गार्डनर ने बताया कि बुद्धि के कई रूप हैं (भाषिक, तार्किक-गणितीय, स्थानिक, संगीतात्मक, शारीरिक-गतिक आदि)।') },
  { id: 'q9', topic: o('Development', 'विकास'), q: o('Stages of moral development are associated with…', 'नैतिक विकास की अवस्थाएँ किससे जुड़ी हैं?'),
    options: [o('Jean Piaget only', 'केवल जीन पियाजे'), o('Lawrence Kohlberg', 'लॉरेंस कोलबर्ग'), o('Edward Thorndike', 'एडवर्ड थॉर्नडाइक'), o('Albert Bandura', 'अल्बर्ट बंडूरा')], answer: 1,
    why: o('Kohlberg described three levels of moral reasoning (pre-conventional, conventional, post-conventional), building on Piaget’s work.', 'कोलबर्ग ने पियाजे के कार्य को आगे बढ़ाते हुए नैतिक तर्क के तीन स्तर बताए (पूर्व-परंपरागत, परंपरागत, उत्तर-परंपरागत)।') },
  { id: 'q10', topic: o('Inclusion', 'समावेशन'), q: o('A Class 3 child often reverses letters such as b and d and reads very slowly despite good effort. The child may need to be checked for…', 'कक्षा 3 का एक बच्चा अक्सर b और d उलट देता है और मेहनत के बावजूद बहुत धीमे पढ़ता है। बच्चे की जाँच किसके लिए करानी चाहिए?'),
    options: [o('Dyscalculia', 'डिस्कैलकुलिया'), o('Dyslexia', 'डिस्लेक्सिया'), o('Dysgraphia only', 'केवल डिस्ग्राफ़िया'), o('Nothing; it is laziness', 'कुछ नहीं; यह आलस है')], answer: 1,
    why: o('Persistent reversals and slow, effortful reading are common signs of dyslexia, a specific learning difficulty in reading. It is never “laziness”.', 'लगातार अक्षर उलटना और धीमा, कठिन पठन डिस्लेक्सिया (पठन की विशिष्ट अधिगम कठिनाई) के सामान्य लक्षण हैं। यह कभी “आलस” नहीं है।') },
  { id: 'q11', topic: o('Pedagogy', 'शिक्षाशास्त्र'), q: o('The best way to introduce place value to Class 2 is…', 'कक्षा 2 में स्थानीय मान का परिचय देने का सबसे अच्छा तरीका है…'),
    options: [o('making children memorise the place-value chart', 'बच्चों से स्थानीय मान तालिका रटवाना'), o('using bundles of ten sticks and loose sticks', 'दस-दस तीलियों के बंडल और खुली तीलियों का उपयोग'), o('writing large numbers on the board', 'बोर्ड पर बड़ी संख्याएँ लिखना'), o('giving a test first', 'पहले परीक्षा लेना')], answer: 1,
    why: o('Young children understand tens and ones by grouping and regrouping concrete objects before moving to symbols.', 'छोटे बच्चे प्रतीकों से पहले ठोस वस्तुओं को समूह में बाँधकर और खोलकर दहाई और इकाई समझते हैं।') },
  { id: 'q12', topic: o('Language', 'भाषा'), q: o('Children learn their first language mainly through…', 'बच्चे अपनी पहली भाषा मुख्य रूप से कैसे सीखते हैं?'),
    options: [o('grammar drills', 'व्याकरण अभ्यास'), o('meaningful interaction with people around them', 'आसपास के लोगों से सार्थक बातचीत'), o('copying from books', 'किताबों से नकल'), o('translation', 'अनुवाद')], answer: 1,
    why: o('Language is acquired by using it for real purposes with others; formal grammar comes much later.', 'भाषा दूसरों के साथ वास्तविक उद्देश्यों के लिए उसका प्रयोग करते हुए सीखी जाती है; औपचारिक व्याकरण बहुत बाद में आता है।') },
  { id: 'q13', topic: o('Policy', 'नीति'), q: o('Under the RTE Act, 2009, which of these is prohibited for teachers?', 'आरटीई अधिनियम, 2009 के अंतर्गत शिक्षकों के लिए इनमें से क्या निषिद्ध है?'),
    options: [o('Group work', 'समूह कार्य'), o('Physical punishment and mental harassment of children', 'बच्चों को शारीरिक दंड और मानसिक उत्पीड़न'), o('Using local language', 'स्थानीय भाषा का प्रयोग'), o('Continuous assessment', 'सतत आकलन')], answer: 1,
    why: o('The Act prohibits physical punishment and mental harassment of children (and also private tuition by teachers).', 'अधिनियम बच्चों को शारीरिक दंड और मानसिक उत्पीड़न का निषेध करता है (और शिक्षकों द्वारा निजी ट्यूशन का भी)।') },
  { id: 'q14', topic: o('Learning', 'अधिगम'), q: o('Which is an example of intrinsic motivation?', 'आंतरिक अभिप्रेरणा का उदाहरण कौन-सा है?'),
    options: [o('Studying to get a prize', 'पुरस्कार पाने के लिए पढ़ना'), o('Studying to avoid scolding', 'डाँट से बचने के लिए पढ़ना'), o('Reading because the child enjoys the story', 'कहानी अच्छी लगने के कारण पढ़ना'), o('Studying for marks only', 'केवल अंकों के लिए पढ़ना')], answer: 2,
    why: o('Intrinsic motivation comes from interest or enjoyment in the activity itself, not from rewards or fear.', 'आंतरिक अभिप्रेरणा गतिविधि में रुचि या आनंद से आती है, पुरस्कार या डर से नहीं।') },
  { id: 'q15', topic: o('Assessment', 'आकलन'), q: o('In the revised Bloom’s taxonomy, the highest level of thinking is…', 'संशोधित ब्लूम वर्गीकरण में चिंतन का सर्वोच्च स्तर है…'),
    options: [o('Remember', 'स्मरण'), o('Apply', 'अनुप्रयोग'), o('Evaluate', 'मूल्यांकन'), o('Create', 'सृजन')], answer: 3,
    why: o('The revised taxonomy runs Remember, Understand, Apply, Analyse, Evaluate, Create.', 'संशोधित वर्गीकरण का क्रम है: स्मरण, बोध, अनुप्रयोग, विश्लेषण, मूल्यांकन, सृजन।') },
];

/** CTET pattern as published in recent notifications (VERIFY against the current bulletin before launch). */
export const CTET_PATTERN = {
  questions: 150, marks: 150, minutes: 150, negative: false, passPercent: 60,
  paper1: [o('Child Development & Pedagogy (30)', 'बाल विकास और शिक्षाशास्त्र (30)'), o('Language I (30)', 'भाषा I (30)'), o('Language II (30)', 'भाषा II (30)'), o('Mathematics (30)', 'गणित (30)'), o('Environmental Studies (30)', 'पर्यावरण अध्ययन (30)')],
  paper2: [o('Child Development & Pedagogy (30)', 'बाल विकास और शिक्षाशास्त्र (30)'), o('Language I (30)', 'भाषा I (30)'), o('Language II (30)', 'भाषा II (30)'), o('Mathematics & Science (60) or Social Studies (60)', 'गणित और विज्ञान (60) या सामाजिक अध्ययन (60)')],
};
