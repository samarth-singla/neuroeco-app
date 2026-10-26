/**
 * Consent, debrief and thank-you texts. Edit here; the screens read from this file.
 * The consent text must not reveal the fraud framing (it is explained in the debrief).
 */

export const CONSENT = {
  title: 'Research study: how people use investment apps',
  intro:
    'You are invited to take part in a study about how people use investment apps. It is part of a university course project.',
  points: [
    'It takes about 15 minutes: you will use a practice investment app for about 10 minutes, then answer some questions.',
    'Taking part is voluntary. You can stop at any time by closing this page.',
    'No real money is involved. The app uses a simulated practice balance only. You will never be asked for payment, bank or card details.',
    'We do not collect your name, email, phone number, ID numbers or any other identifying information. You are identified only by a random code.',
    'Your answers are used only for this course project.',
  ],
  checkAge: 'I am 18 years old or older.',
  checkAgree: 'I have read the information above and agree to take part.',
  agreeCta: 'Agree and start',
  declineCta: 'I do not want to take part',
  declinedTitle: 'Thank you',
  declinedBody:
    'You chose not to take part. No information about you has been recorded. You can close this page now.',
};

/** What each fraud-style feature was, for the debrief list. */
export const DEBRIEF_FEATURES = [
  {
    name: 'Countdown timer',
    what: 'The "offer ends in…" clock created false urgency. It simply restarted at zero.',
  },
  {
    name: 'Fake scarcity',
    what: '"Only 3 slots left" was never true. There was no limit.',
  },
  {
    name: 'Locked sign-up bonus',
    what: 'The ₹500 bonus could only be withdrawn after a deposit — a hook to make you deposit.',
  },
  {
    name: 'VIP tiers',
    what: 'Higher "VIP" levels promised bigger returns for bigger deposits, to push larger deposits.',
  },
  {
    name: 'Fake regulator badge and certificate',
    what: 'The "NDIA" authority does not exist. Scam apps use fake or look-alike registrations.',
  },
  {
    name: 'Fake withdrawal ticker and testimonials',
    what: 'The live withdrawals and member "screenshots" were made up to create social proof.',
  },
  {
    name: 'Mentor chat',
    what: 'The friendly "success mentor" was a script designed to nudge you to deposit more.',
  },
  {
    name: 'Withdrawal "tax"',
    what: 'Asking for a fee before you can withdraw is a classic sign of fraud. Paying never unlocks the money.',
  },
];

export const DEBRIEF = {
  title: 'About this study',
  reveal:
    'Thank you! Now we can tell you what the study was really about. The app you used was a simulation of the investment-fraud apps that have cost many people in India their savings. We studied how design features of such apps affect decisions.',
  fraudVersion:
    'You saw the fraud-style version of the app. It contained these manipulative features:',
  plainVersion:
    'You saw the plain version of the app. Other participants saw a fraud-style version with these manipulative features:',
  scripted:
    'The results inside the app were pre-set, not real market results: the first-cycle result and the 30% "market correction" were decided in advance, and some participants were offered a small withdrawal while others were not. Different participants also saw slightly different questions in the survey.',
  tipsTitle: 'How to protect yourself',
  // DECISION: plan rule 3 forbids real regulator names anywhere in the app, so the tips say
  // "the official securities regulator" instead of naming it. The team may name it here if
  // the course instructor agrees, since this is educational, not branding.
  tips: [
    "Before investing, check that the app or company is registered on the official securities regulator's website — not just a badge or certificate shown inside the app.",
    'Never pay a fee, "tax" or deposit to unlock a withdrawal.',
    'Be very wary of guaranteed or very high daily returns, countdown offers and "limited slots".',
    'Be careful with "mentors", WhatsApp/Telegram groups and referral links, even from friends.',
    'If you are a victim, report it at cybercrime.gov.in or call the cybercrime helpline 1930.',
  ],
  withdrawTitle: 'Your data',
  withdrawBody:
    'Now that you know the purpose of the study, you may withdraw your data. It will then be excluded from all analysis.',
  withdrawCta: 'Withdraw my data',
  withdrawConfirm: 'Are you sure? Your answers will not be used.',
  withdrawYes: 'Yes, withdraw my data',
  withdrawNo: 'Cancel',
  withdrawError: 'Could not withdraw your data. Please check your connection and try again.',
  continueCta: 'Finish',
};

export const THANKS = {
  title: 'Thank you for taking part!',
  body: 'Your participation is complete. You can close this page now.',
  withdrawnBody:
    'Your data has been withdrawn and will not be used. Thank you for your time. You can close this page now.',
};
