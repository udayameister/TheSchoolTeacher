/*
 * Interview & demo-class preparation content (original text written for TheSchoolTeacher.in, English and Hindi).
 * This is guidance, not master data: it does not drive any matching or rule.
 */

export type L = { en: string; hi: string };
export interface PrepQuestion { id: string; q: L; tip: L }
export interface PrepGroup { id: string; title: L; questions: PrepQuestion[] }

export const QUESTION_GROUPS: PrepGroup[] = [
  {
    id: 'general', title: { en: 'About you', hi: 'आपके बारे में' },
    questions: [
      { id: 'g1', q: { en: 'Tell us about yourself and why you became a teacher.', hi: 'अपने बारे में बताइए और आप शिक्षक क्यों बने?' }, tip: { en: 'Keep it to about a minute: qualifications, classes and subjects you teach, one moment that made you choose teaching, and what you want to do next.', hi: 'लगभग एक मिनट में: योग्यता, कौन-सी कक्षाएँ और विषय पढ़ाते हैं, एक घटना जिससे आपने शिक्षण चुना, और आगे क्या करना चाहते हैं।' } },
      { id: 'g2', q: { en: 'Why do you want to join our school?', hi: 'आप हमारे विद्यालय से क्यों जुड़ना चाहते हैं?' }, tip: { en: 'Read the school page before the interview. Mention one specific thing (board, results, activities, values) and connect it to your own strengths.', hi: 'साक्षात्कार से पहले विद्यालय का पेज पढ़ें। कोई एक खास बात (बोर्ड, परिणाम, गतिविधियाँ, मूल्य) बताइए और उसे अपनी खूबी से जोड़िए।' } },
      { id: 'g3', q: { en: 'What are your strengths and one area you are improving?', hi: 'आपकी खूबियाँ क्या हैं और आप किस बात में सुधार कर रहे हैं?' }, tip: { en: 'Give an example for each. For the area to improve, say what you are already doing about it (a course, feedback from a mentor).', hi: 'दोनों के लिए उदाहरण दें। सुधार वाली बात के लिए बताइए कि आप उस पर अभी क्या कर रहे हैं (कोई कोर्स, किसी मार्गदर्शक से फीडबैक)।' } },
      { id: 'g4', q: { en: 'Where do you see yourself in five years?', hi: 'पाँच साल बाद आप स्वयं को कहाँ देखते हैं?' }, tip: { en: 'Schools want stability. Talk about growing in this role: a higher class, a coordinator role, a qualification you plan to add.', hi: 'विद्यालय स्थिरता चाहते हैं। इसी भूमिका में आगे बढ़ने की बात करें: ऊँची कक्षा, समन्वयक की भूमिका, कोई नई योग्यता।' } },
    ],
  },
  {
    id: 'pedagogy', title: { en: 'Teaching and learning', hi: 'शिक्षण और अधिगम' },
    questions: [
      { id: 'p1', q: { en: 'How do you start a new topic so that every child is engaged?', hi: 'नया पाठ कैसे शुरू करते हैं ताकि हर बच्चा जुड़ जाए?' }, tip: { en: 'Describe a real hook you have used: a question, an object, a short story or a link to daily life, then how you checked what the children already knew.', hi: 'कोई वास्तविक तरीका बताइए जो आपने अपनाया हो: प्रश्न, कोई वस्तु, छोटी कहानी या रोज़मर्रा के जीवन से जुड़ाव; फिर बताइए कि बच्चों की पूर्व जानकारी कैसे जाँची।' } },
      { id: 'p2', q: { en: 'How do you teach a class where children learn at very different levels?', hi: 'जिस कक्षा में बच्चे अलग-अलग स्तर पर सीखते हैं, उसे कैसे पढ़ाते हैं?' }, tip: { en: 'Talk about grouping, graded worksheets, peer support and extra time for those who need it. One concrete example is better than a list.', hi: 'समूह बनाना, अलग-अलग स्तर की वर्कशीट, साथियों की मदद और ज़रूरतमंद बच्चों के लिए अतिरिक्त समय की बात करें। सूची से बेहतर एक ठोस उदाहरण है।' } },
      { id: 'p3', q: { en: 'How do you know that the children have understood?', hi: 'आपको कैसे पता चलता है कि बच्चों ने समझ लिया?' }, tip: { en: 'Mention checks during the lesson (questions, exit slips, quick quizzes, observation) and what you do with the result, not only unit tests.', hi: 'पाठ के दौरान की जाँच (प्रश्न, एग्ज़िट स्लिप, छोटी क्विज़, अवलोकन) और उनके परिणाम से आप क्या करते हैं, यह बताइए; केवल यूनिट टेस्ट नहीं।' } },
      { id: 'p4', q: { en: 'How do you use technology in your classroom?', hi: 'आप कक्षा में तकनीक का उपयोग कैसे करते हैं?' }, tip: { en: 'Name the tools you have actually used (smart board, DIKSHA, videos, quizzes) and say how they helped learning, not just that you used them.', hi: 'जिन साधनों का वास्तव में उपयोग किया है उनके नाम लें (स्मार्ट बोर्ड, दीक्षा, वीडियो, क्विज़) और बताइए कि उनसे सीखने में क्या मदद मिली।' } },
      { id: 'p5', q: { en: 'What does activity-based or experiential learning look like in your subject?', hi: 'आपके विषय में गतिविधि-आधारित या अनुभवात्मक अधिगम कैसा दिखता है?' }, tip: { en: 'Give one activity from start to end: the aim, what children did, what they produced and how you assessed it.', hi: 'एक गतिविधि शुरू से अंत तक बताइए: उद्देश्य, बच्चों ने क्या किया, क्या बनाया और आपने उसका आकलन कैसे किया।' } },
    ],
  },
  {
    id: 'classroom', title: { en: 'Classroom management', hi: 'कक्षा प्रबंधन' },
    questions: [
      { id: 'c1', q: { en: 'A child keeps disturbing the class. What do you do?', hi: 'एक बच्चा बार-बार कक्षा में बाधा डालता है। आप क्या करेंगे?' }, tip: { en: 'Show calm, respectful steps: understand the reason, talk privately, set clear expectations, involve parents or the counsellor if needed. Never mention punishment.', hi: 'शांत और सम्मानजनक कदम बताइए: कारण समझना, अकेले में बात करना, स्पष्ट अपेक्षाएँ रखना, ज़रूरत हो तो अभिभावक या काउंसलर को शामिल करना। दंड का उल्लेख न करें।' } },
      { id: 'c2', q: { en: 'How do you build routines in a new class at the start of the year?', hi: 'साल की शुरुआत में नई कक्षा में दिनचर्या कैसे बनाते हैं?' }, tip: { en: 'Talk about the first two weeks: classroom rules made with the children, seating, roles, and how you learn every name quickly.', hi: 'पहले दो हफ़्तों की बात करें: बच्चों के साथ मिलकर बनाए नियम, बैठने की व्यवस्था, ज़िम्मेदारियाँ, और सबके नाम जल्दी याद करने का तरीका।' } },
      { id: 'c3', q: { en: 'A parent is unhappy with their child’s marks. How do you handle it?', hi: 'एक अभिभावक बच्चे के अंकों से नाराज़ हैं। आप कैसे संभालेंगे?' }, tip: { en: 'Listen first, show the child’s work and the marking scheme, agree on a plan to help the child, and follow up.', hi: 'पहले सुनिए, बच्चे की कॉपी और अंक-योजना दिखाइए, बच्चे की मदद के लिए मिलकर योजना बनाइए, और बाद में फ़ॉलो-अप कीजिए।' } },
    ],
  },
  {
    id: 'inclusion', title: { en: 'Inclusion and child safety', hi: 'समावेशन और बाल सुरक्षा' },
    questions: [
      { id: 'i1', q: { en: 'How would you support a child with a learning difficulty?', hi: 'सीखने में कठिनाई वाले बच्चे की मदद आप कैसे करेंगे?' }, tip: { en: 'Mention observing and noting the difficulty, simple adaptations (seating, shorter tasks, visuals), working with the special educator and parents.', hi: 'कठिनाई को देखना और लिखना, सरल बदलाव (बैठने की जगह, छोटे कार्य, चित्र), विशेष शिक्षक और अभिभावकों के साथ काम करने की बात करें।' } },
      { id: 'i2', q: { en: 'What would you do if a child tells you something that worries you about their safety?', hi: 'यदि कोई बच्चा आपको अपनी सुरक्षा से जुड़ी चिंताजनक बात बताए तो आप क्या करेंगे?' }, tip: { en: 'Listen calmly, do not promise secrecy, do not investigate yourself, write down what was said and report it the same day to the designated person, as your school’s child-protection policy and the POCSO Act require.', hi: 'शांति से सुनें, गोपनीयता का वादा न करें, खुद जाँच न करें, बच्चे की बात लिख लें और उसी दिन विद्यालय की बाल-संरक्षण नीति और पॉक्सो अधिनियम के अनुसार नामित व्यक्ति को सूचित करें।' } },
      { id: 'i3', q: { en: 'How do you make sure girls and quieter children take part equally?', hi: 'आप कैसे सुनिश्चित करते हैं कि लड़कियाँ और शांत बच्चे बराबर भाग लें?' }, tip: { en: 'Talk about mixed groups, rotating roles, wait time after questions and calling on children by name in a fair order.', hi: 'मिश्रित समूह, बारी-बारी से भूमिकाएँ, प्रश्न के बाद सोचने का समय और सबको निष्पक्ष क्रम में नाम से बुलाने की बात करें।' } },
    ],
  },
  {
    id: 'policy', title: { en: 'Education policy and current practice', hi: 'शिक्षा नीति और वर्तमान प्रथाएँ' },
    questions: [
      { id: 'n1', q: { en: 'What changes from NEP 2020 matter most for your classroom?', hi: 'राष्ट्रीय शिक्षा नीति 2020 के कौन-से बदलाव आपकी कक्षा के लिए सबसे महत्वपूर्ण हैं?' }, tip: { en: 'Pick two or three you can explain with an example, such as foundational literacy and numeracy, competency-based assessment, mother-tongue learning or experiential learning.', hi: 'दो-तीन ऐसे बदलाव चुनिए जिन्हें उदाहरण से समझा सकें, जैसे बुनियादी साक्षरता और संख्या-ज्ञान, योग्यता-आधारित आकलन, मातृभाषा में अधिगम या अनुभवात्मक अधिगम।' } },
      { id: 'n2', q: { en: 'How do you prepare children for competency-based questions?', hi: 'आप बच्चों को योग्यता-आधारित प्रश्नों के लिए कैसे तैयार करते हैं?' }, tip: { en: 'Explain how you use case-based and real-life questions in class, not only at exam time, and how you teach children to read the question carefully.', hi: 'बताइए कि आप केस-आधारित और वास्तविक जीवन के प्रश्न कक्षा में नियमित रूप से कैसे पूछते हैं, और बच्चों को प्रश्न ध्यान से पढ़ना कैसे सिखाते हैं।' } },
    ],
  },
  {
    id: 'leadership', title: { en: 'For coordinators, vice-principals and principals', hi: 'समन्वयक, उप-प्रधानाचार्य और प्रधानाचार्य के लिए' },
    questions: [
      { id: 'l1', q: { en: 'How do you support a teacher whose results are falling?', hi: 'जिस शिक्षक के परिणाम गिर रहे हैं, उसकी मदद कैसे करेंगे?' }, tip: { en: 'Show a fair process: classroom observation, a conversation, a clear improvement plan with support (mentoring, training), and a review date.', hi: 'निष्पक्ष प्रक्रिया बताइए: कक्षा अवलोकन, बातचीत, सहायता (मार्गदर्शन, प्रशिक्षण) के साथ स्पष्ट सुधार योजना, और समीक्षा की तारीख।' } },
      { id: 'l2', q: { en: 'What would you change in your first 90 days?', hi: 'पहले 90 दिनों में आप क्या बदलेंगे?' }, tip: { en: 'Say that you would listen and learn first (data, staff, parents, students), then pick a few priorities. Avoid promising big changes before you know the school.', hi: 'बताइए कि पहले आप सुनेंगे और समझेंगे (आँकड़े, स्टाफ़, अभिभावक, विद्यार्थी), फिर कुछ प्राथमिकताएँ चुनेंगे। विद्यालय को जाने बिना बड़े बदलावों का वादा न करें।' } },
    ],
  },
];

export interface CheckItemL { id: string; text: L }

export const DEMO_CHECKLIST: CheckItemL[] = [
  { id: 'd1', text: { en: 'Ask the school for the class, topic, duration and board before the day.', hi: 'पहले ही विद्यालय से कक्षा, विषय-वस्तु, समय-सीमा और बोर्ड पूछ लें।' } },
  { id: 'd2', text: { en: 'Write two or three clear learning outcomes ("By the end, children will be able to…").', hi: 'दो-तीन स्पष्ट अधिगम परिणाम लिखें ("अंत तक बच्चे … कर पाएँगे")।' } },
  { id: 'd3', text: { en: 'Plan a hook for the first two minutes that links to the children’s lives.', hi: 'पहले दो मिनट के लिए ऐसी शुरुआत सोचें जो बच्चों के जीवन से जुड़ी हो।' } },
  { id: 'd4', text: { en: 'Keep the children doing something every few minutes: answering, writing, discussing in pairs.', hi: 'हर कुछ मिनट में बच्चों को कुछ करने दें: उत्तर देना, लिखना, जोड़ी में चर्चा।' } },
  { id: 'd5', text: { en: 'Prepare a simple teaching aid or board plan; do not depend only on a projector.', hi: 'एक सरल शिक्षण सामग्री या बोर्ड-योजना तैयार रखें; केवल प्रोजेक्टर पर निर्भर न रहें।' } },
  { id: 'd6', text: { en: 'Ask open questions and give thinking time before taking answers.', hi: 'खुले प्रश्न पूछें और उत्तर लेने से पहले सोचने का समय दें।' } },
  { id: 'd7', text: { en: 'Check understanding before you finish (exit question, quick quiz, show of fingers).', hi: 'समाप्त करने से पहले समझ जाँचें (एग्ज़िट प्रश्न, छोटी क्विज़, उँगलियों से संकेत)।' } },
  { id: 'd8', text: { en: 'Leave two minutes to sum up and give a small home task.', hi: 'सारांश और छोटे गृहकार्य के लिए दो मिनट रखें।' } },
  { id: 'd9', text: { en: 'Carry a printed lesson plan for the panel.', hi: 'पैनल के लिए छपी हुई पाठ-योजना साथ रखें।' } },
  { id: 'd10', text: { en: 'Practise once with a timer, aloud.', hi: 'एक बार टाइमर लगाकर ज़ोर से अभ्यास करें।' } },
];

export const DOCUMENT_CHECKLIST: CheckItemL[] = [
  { id: 'k1', text: { en: 'Updated resume (two printed copies)', hi: 'अद्यतन बायोडाटा (दो छपी प्रतियाँ)' } },
  { id: 'k2', text: { en: 'Mark sheets and degree certificates (originals and one set of self-attested copies)', hi: 'अंकपत्र और डिग्री प्रमाणपत्र (मूल और स्व-सत्यापित प्रतियों का एक सेट)' } },
  { id: 'k3', text: { en: 'B.Ed / D.El.Ed or other teacher-education certificate', hi: 'बी.एड / डी.एल.एड या अन्य शिक्षक-शिक्षा प्रमाणपत्र' } },
  { id: 'k4', text: { en: 'TET / CTET certificate or scorecard', hi: 'टीईटी / सीटीईटी प्रमाणपत्र या स्कोरकार्ड' } },
  { id: 'k5', text: { en: 'Experience and relieving letters, last salary slip if asked', hi: 'अनुभव और कार्यमुक्ति पत्र, माँगने पर अंतिम वेतन पर्ची' } },
  { id: 'k6', text: { en: 'Photo ID and address proof', hi: 'फ़ोटो पहचान-पत्र और पते का प्रमाण' } },
  { id: 'k7', text: { en: 'Passport-size photographs', hi: 'पासपोर्ट आकार के फ़ोटो' } },
  { id: 'k8', text: { en: 'Police verification or child-safety training certificate, if you have one', hi: 'पुलिस सत्यापन या बाल-सुरक्षा प्रशिक्षण प्रमाणपत्र, यदि हो' } },
  { id: 'k9', text: { en: 'Your lesson plan for the demo class', hi: 'डेमो कक्षा की पाठ-योजना' } },
];

/** Phases of the lesson planner (5E model), with the default share of the lesson time. */
export const PLAN_PHASES: { id: string; share: number; name: L; prompt: L }[] = [
  { id: 'engage', share: 0.1, name: { en: 'Engage', hi: 'जोड़ना (Engage)' }, prompt: { en: 'Hook: a question, object, picture or short story that links the topic to the children’s lives. Find out what they already know.', hi: 'शुरुआत: कोई प्रश्न, वस्तु, चित्र या छोटी कहानी जो विषय को बच्चों के जीवन से जोड़े। पता करें कि वे पहले से क्या जानते हैं।' } },
  { id: 'explore', share: 0.25, name: { en: 'Explore', hi: 'खोजना (Explore)' }, prompt: { en: 'Children try something in pairs or groups: an activity, a problem, an observation. You move around and listen.', hi: 'बच्चे जोड़ी या समूह में कुछ करके देखें: गतिविधि, समस्या, अवलोकन। आप घूमकर सुनें।' } },
  { id: 'explain', share: 0.25, name: { en: 'Explain', hi: 'समझाना (Explain)' }, prompt: { en: 'Children share what they found; you name the concept, correct misconceptions and build the board summary with them.', hi: 'बच्चे बताएँ कि उन्होंने क्या पाया; आप अवधारणा का नाम दें, भ्रांतियाँ दूर करें और उनके साथ बोर्ड पर सारांश बनाएँ।' } },
  { id: 'elaborate', share: 0.25, name: { en: 'Elaborate', hi: 'विस्तार (Elaborate)' }, prompt: { en: 'Apply it to a new situation: a real-life question, a short task at different levels of difficulty.', hi: 'नई स्थिति में लागू करें: वास्तविक जीवन का प्रश्न, अलग-अलग कठिनाई स्तर का छोटा कार्य।' } },
  { id: 'evaluate', share: 0.15, name: { en: 'Evaluate', hi: 'मूल्यांकन (Evaluate)' }, prompt: { en: 'Check understanding (exit question, quick quiz), sum up, and set a small home task.', hi: 'समझ की जाँच (एग्ज़िट प्रश्न, छोटी क्विज़), सारांश, और छोटा गृहकार्य।' } },
];
