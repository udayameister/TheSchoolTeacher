/*
 * Founders and company (shown on the home page and /about). Same people and facts as the About page of
 * AcadeXMatch (www.acadexmatch.com/about), the sister product by UKQAAI Technologies. Edit here to update both pages.
 */
import type { L } from './interviewPrep';

export const COMPANY = { name: 'UKQAAI Technologies', url: 'https://www.ukqaai.com', sister: { name: 'AcadeXMatch', url: 'https://www.acadexmatch.com', what: { en: 'faculty recruitment for colleges and universities', hi: 'कॉलेजों और विश्वविद्यालयों के लिए संकाय भर्ती' } } };

export interface Person { name: string; role: L; photo: { src: string; width: number; height: number }; summary: L; highlights: L[]; note: L; links: { label: string; href: string }[] }

export const FOUNDERS: Person[] = [
  {
    name: 'Udayakumar Palanivelu',
    role: { en: 'Founder & CEO', hi: 'संस्थापक और सीईओ' },
    photo: { src: '/brand/founder.jpg', width: 436, height: 447 },
    summary: { en: 'Computer science educator and researcher with more than 15 years of teaching experience in India and Ethiopia.', hi: 'कंप्यूटर विज्ञान के शिक्षक और शोधकर्ता, भारत और इथियोपिया में 15 से अधिक वर्षों का शिक्षण अनुभव।' },
    highlights: [
      { en: 'Ph.D. research at Vellore Institute of Technology (VIT) in deep learning and graph neural networks', hi: 'वेल्लोर इंस्टीट्यूट ऑफ़ टेक्नोलॉजी (VIT) में डीप लर्निंग और ग्राफ़ न्यूरल नेटवर्क पर पीएच.डी. शोध' },
      { en: 'Raman Research Award (2024, 2025) and Dr. APJ Abdul Kalam Award (2024)', hi: 'रमन रिसर्च अवॉर्ड (2024, 2025) और डॉ. एपीजे अब्दुल कलाम अवॉर्ड (2024)' },
      { en: 'Founder of AcadeXMatch, the academic recruitment platform for Indian higher education', hi: 'भारतीय उच्च शिक्षा के लिए शैक्षणिक भर्ती मंच AcadeXMatch के संस्थापक' },
    ],
    note: {
      en: 'Fifteen years in classrooms showed me how hard hiring is on both sides: teachers chase scattered notices and unclear eligibility rules, and schools sift through piles of applications by hand. TheSchoolTeacher brings vacancies, TET and qualification rules, demo classes and offer letters into one clear place, so the right teacher reaches the right classroom.',
      hi: 'पंद्रह वर्षों की कक्षाओं ने दिखाया कि भर्ती दोनों तरफ़ कितनी कठिन है: शिक्षक बिखरी सूचनाओं और अस्पष्ट पात्रता नियमों के पीछे भागते हैं, और विद्यालय ढेरों आवेदन हाथ से छाँटते हैं। TheSchoolTeacher रिक्तियाँ, टीईटी और योग्यता नियम, डेमो कक्षाएँ और नियुक्ति पत्र एक स्पष्ट जगह पर लाता है, ताकि सही शिक्षक सही कक्षा तक पहुँचे।',
    },
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/udayakumar-palanivelu-934bb941' },
      { label: 'GitHub', href: 'https://github.com/udayameister' },
    ],
  },
  {
    name: 'Dr. M. Indhumathi',
    role: { en: 'Co-Founder', hi: 'सह-संस्थापक' },
    photo: { src: '/brand/cofounder.jpg', width: 183, height: 236 },
    summary: { en: 'Ph.D. in Computer Science (Wireless Sensor Networks), Bharathidasan University, Tiruchirappalli', hi: 'कंप्यूटर विज्ञान (वायरलेस सेंसर नेटवर्क) में पीएच.डी., भारतीदासन विश्वविद्यालय, तिरुचिरापल्ली' },
    highlights: [],
    note: {
      en: 'A school is only as strong as the teachers it appoints. We want every deserving teacher to find the right position on merit, and every school to hire with clarity and fairness instead of months of paperwork.',
      hi: 'कोई विद्यालय उतना ही मज़बूत होता है जितने उसके नियुक्त शिक्षक। हम चाहते हैं कि हर योग्य शिक्षक को योग्यता के आधार पर सही पद मिले, और हर विद्यालय महीनों की काग़ज़ी कार्रवाई के बजाय स्पष्टता और निष्पक्षता से भर्ती करे।',
    },
    links: [],
  },
];
