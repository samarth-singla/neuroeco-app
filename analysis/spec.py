"""Fixed text for every hypothesis: claim (from hypothesis-report.md), how the experiment tests it, the maths, the
pre-registered primary/secondary tests, figures and tables. No result numbers live here; they come from
results.json and the tables."""

SKIN_HOW = ("Players were randomly assigned to the fraud skin (\"ZenTrade X\") or the honest skin (\"ZenTrade\"). "
            "Both skins run the same scripted market, amounts, returns and payoffs (checked by an automated "
            "skin-parity test); only the presentation differs. So any difference between the two groups can only "
            "come from the design layer, not from different incentives.")
BUNDLE = ("The fraud skin switches on all dark-design features at once, so a skin difference cannot be attributed "
          "to one feature on its own.")

SPEC = {
    "H1": dict(
        title="Dark design overrides deliberate judgment", short="Dark design",
        claim="Participants using the fraud-style app decide faster, invest more often and in larger amounts, verify "
              "less, and rate the app as more urgent and trustworthy than participants using a plain version with "
              "the same returns.",
        prediction="Fraud players deposit more in total (and decide faster, invest more often, verify less, trust "
                   "more, feel more urgency).",
        primary="H1.primary",
        secondary=["H1.sec.decision_time", "H1.sec.invested_r1", "H1.sec.verify_any", "H1.sec.app_trust",
                   "H1.sec.app_urgency", "H1.sec.trap_score_shared8"],
        extra=["H1.mod.fraud_x_crt", "H1.rob.decision_time_no_outliers", "H1.rob.r1_amount", "H1.itt.invested_r1",
               "H1.itt.decision_time", "H1.itt.r1_amount"],
        how=SKIN_HOW + " The primary outcome is the total amount a player put in over the whole game; the secondary "
                       "outcomes cover each part of the claim (speed, investing, verification, ratings, traps).",
        maths="""total_deposited = Σ round stakes + Σ deal stakes + pool + post-withdrawal deposit + Gold Plan + top-up
trap_score_shared8 = Σ of the 8 trap flags both skins share (0–8)

Mann-Whitney U, two-sided; effect = Cliff's δ = P(X_fraud > X_honest) − P(X_fraud < X_honest)
H0: P(X_fraud > X_honest) = P(X_fraud < X_honest)      (δ = 0)
H1: P(X_fraud > X_honest) > P(X_fraud < X_honest)      (δ > 0, tested two-sided)

Moderator (exploratory): log(1 + total_deposited) = β0 + β1·fraud + β2·crt + β3·fraud·crt + β4·exp_investing
                         + β5·trading_app + ε   (HC3 SEs);  H0: β3 = 0""",
        figures=["H1"], tables=["H1_effect_sizes", "H1_moderator_ols"],
        overclaim="The skin comparison shows the effect of the whole dark-design bundle. It does not show which "
                  "feature caused it (" + BUNDLE.lower().rstrip(".") + "), and with virtual money it shows "
                  "behaviour in a game, not real losses.",
    ),
    "H1a": dict(
        title="Countdown timers and \"only 3 slots left\"", short="Timer / scarcity",
        claim="Countdown timers and \"only 3 slots left\" on investment plans (urgency, scarcity) lead to faster "
              "decisions and more investing.",
        prediction="Fraud players make the first decision faster than honest players.",
        primary="H1ae.primary", secondary=["H1a.sec.feature_push_timer"], extra=["H1ae.rob.no_outliers"],
        how=SKIN_HOW + " The timer and the slots counter appear on the fraud home screen, so the first decision "
                       "time (from the moment the home screen is usable to the first Invest/Skip tap; for fraud, "
                       "after the VIP pop-up is closed) is the linked behaviour. The feature card asks fraud "
                       "players whether the timer pushed them.",
        maths="""decision_time_first_invest = t(first Invest/Skip on S3) − t(S3 usable)

Mann-Whitney U, two-sided; δ = P(T_fraud > T_honest) − P(T_fraud < T_honest)
H0: δ = 0        H1: δ < 0 (fraud faster)
Feature card: share p̂ = k / n with Wilson 95% CI""",
        figures=["H1a_H1e", "H1h"], tables=[],
        overclaim="Even a faster fraud decision could come from any part of the fraud home screen (VIP pop-up, "
                  "ticker, badge, look), not the timer alone. The feature card is a self-report.",
    ),
    "H1b": dict(
        title="Sign-up bonus locked until the first deposit", short="Locked bonus",
        claim="A sign-up bonus credited to the wallet but withdrawable only after a first deposit (endowment, "
              "reciprocity) raises the first-deposit rate.",
        prediction="More fraud players invest in round 1 (the first real deposit).",
        primary="H1b.primary", secondary=["H1b.sec.feature_push_bonus"],
        how=SKIN_HOW + " Both skins give the same ₹500 bonus; only the fraud skin locks it until the first deposit "
                       "and says so. trap_hook = 1 when the round-1 stake is above 0.",
        maths="""trap_hook = 1[r1_amount > 0]

Fisher's exact test on the 2×2 table skin × trap_hook; OR = (a·d)/(b·c), Woolf CI
H0: OR = 1        H1: OR > 1""",
        figures=["H1b"], tables=[],
        overclaim="A higher hook rate in the fraud skin would still not isolate the locked bonus from the other "
                  "fraud features.",
    ),
    "H1c": dict(
        title="VIP levels", short="VIP levels",
        claim="VIP levels where bigger deposits unlock higher daily returns (goal gradient, status, sunk cost) "
              "lead to larger deposits to reach the next tier.",
        prediction="More fraud players deposit at least ₹5,000 (VIP 2).",
        primary="H1c.primary", secondary=["H1c.sec.vip_level", "H1c.sec.feature_push_vip"],
        how=SKIN_HOW + " The VIP level is computed the same way in both skins from total deposits, but only fraud "
                       "players see the VIP pop-up, bar, nudges and level-up banner. The promised higher returns "
                       "always start \"next cycle\", so payoffs stay identical.",
        maths="""vip_level = 0 if total < 1,000; 1 if < 5,000; 2 if < 10,000; else 3
vip_upgrade = 1[total_deposited ≥ 5,000]

Fisher's exact test (skin × vip_upgrade): H0: OR = 1, H1: OR > 1
Mann-Whitney U on vip_level: H0: δ = 0, H1: δ > 0""",
        figures=["H1c"], tables=["H1c_vip_level_by_skin", "H1c_vip_within_fraud"],
        overclaim="VIP level is a function of total deposits, so it is not independent of H1's primary outcome. "
                  "The VIP layer is bundled with the other fraud features.",
    ),
    "H1d": dict(
        title="Fake regulatory credentials", short="Fake credentials",
        claim="Fake regulatory credentials (badges, certificates; the fictional regulator \"NDIA\") raise trust "
              "and lead to fewer verification checks.",
        prediction="Fewer fraud players open any T&C, details, badge or About page.",
        primary="H1d.primary", secondary=["H1d.sec.verify_count", "H1d.sec.feature_push_regulator"],
        how=SKIN_HOW + " Every verification opportunity (T&C, plan/deal/pool details, badge, About) is logged. The "
                       "fraud skin shows a badge with a certificate; the honest skin has an About page saying the "
                       "app is not registered.",
        maths="""verify_any = 1[verify_count > 0]

Fisher's exact test (skin × verify_any): H0: OR = 1, H1: OR < 1
Mann-Whitney U on verify_count: H0: δ = 0, H1: δ < 0""",
        figures=["H1d"], tables=[],
        overclaim="Opening the fraud badge counts as a verification click, so the badge itself creates something "
                  "to check; the two skins do not offer identical things to verify.",
    ),
    "H1e": dict(
        title="Social proof (ticker, testimonials)", short="Social proof",
        claim="A live withdrawal ticker and screenshot testimonials (social proof, FOMO) lead to more investing and "
              "faster decisions.",
        prediction="Fraud players make the first decision faster than honest players.",
        primary="H1ae.primary", secondary=["H1e.sec.feature_push_social"], extra=["H1ae.rob.no_outliers"],
        how=SKIN_HOW + " The ticker, winner toasts and testimonials run on the fraud home screen, so the shared "
                       "linked behaviour is again the first decision time (the same test as H1a).",
        maths="""Same test as H1a: Mann-Whitney U on decision_time_first_invest, H0: δ = 0, H1: δ < 0
Feature card: share with Wilson 95% CI""",
        figures=["H1a_H1e", "H1h"], tables=[],
        overclaim="H1a and H1e share one test, so the data cannot separate social proof from the timer.",
    ),
    "H1f": dict(
        title="Mentor chat nudging deposits", short="Mentor chat",
        claim="A \"customer service\" or mentor chat that nudges users to deposit (authority, social trust) raises "
              "the deposit after the nudge.",
        prediction="Fraud players (who see the chat right before round 4) stake more in round 4.",
        primary="H1f.primary", secondary=["H1f.sec.chat_deposit", "H1f.sec.feature_push_chat"],
        how=SKIN_HOW + " The chat appears only in the fraud skin, right before round 4; the honest skin has no chat "
                       "screen, so the round-4 stake is the cross-skin proxy. Within fraud, chat_deposit = any "
                       "deposit within 60 s of the chat appearing.",
        maths="""chat_deposit = 1[any deposit with 0 ≤ since_chat_ms ≤ 60,000]   (fraud only)

Mann-Whitney U on r4_amount: H0: δ = 0, H1: δ > 0
Within fraud: share with Wilson 95% CI""",
        figures=["H1f"], tables=[],
        overclaim="Round 4 differs between skins in more than the chat (all fraud features stay on), so even a "
                  "higher fraud round-4 stake would not isolate the chat. chat_deposit has no honest baseline, so its "
                  "rate cannot be read as an effect of the chat.",
    ),
    "H1g": dict(
        title="Withdrawal blocked by a \"tax\"", short="Withdrawal tax",
        claim="A withdrawal blocked by a \"tax\", fee or freeze until an extra payment (endowment, loss aversion, "
              "sunk cost) makes people pay to unlock.",
        prediction="Fraud players pay the tax to unlock their withdrawal.",
        primary="H1g.primary", secondary=["H1g.sec.feature_push_tax"], kind="no_comparison",
        how="Only the fraud skin blocks the final withdrawal with a 10% \"processing tax\"; the honest skin pays out "
            "instantly. There is no comparison group, so the share who paid is a description of willingness to "
            "pay, not a test of whether the tax causes paying.",
        maths="""tax_paid rate = k / n among fraud players shown the tax, Wilson 95% CI
No H0 / H1: no comparison group exists""",
        figures=["H1g"], tables=[],
        overclaim="Without a control condition the data cannot say the tax design caused payment, or how many "
                  "would pay under a neutral fee message. Paying cost virtual money only.",
    ),
    "H1h": dict(
        title="UX map: which features felt persuasive", short="UX map",
        claim="Each sub-hypothesis is also tested through the fraud-only feature swipe cards: the share of players "
              "saying each feature pushed them to invest (the design-vulnerability map).",
        prediction="Descriptive: rank the seven features by the share of fraud players who felt pushed.",
        primary=None, kind="descriptive",
        how="After the game (before the reveal), fraud players saw a mini re-render of each feature and answered "
            "\"Did this push you to invest?\" (yes/no). Honest players never saw the features, so there is no "
            "comparison.",
        maths="""p̂_feature = (# fraud players answering yes) / (# fraud players answering), Wilson 95% CI""",
        figures=["H1h"], tables=["H1h_ux_map"],
        overclaim="Self-reports of being pushed are not the same as being pushed: players may not notice or admit "
                  "influence, and the wording invites agreement.",
    ),
    "H2": dict(
        title="An early small win increases later investment", short="Early win",
        claim="Participants who see a small profit after their first investment invest more in the next round "
              "than those who see no gain.",
        prediction="Players randomized to a +8% round 1 escalate their round-2 stake more than players with a "
                   "flat round 1.",
        primary="H2.primary", secondary=["H2.sec.r2_amount"], extra=["H2.itt.escalation_ratio", "H2.itt.r2_amount"],
        how="Round 1's result was randomized (+8% small win vs 0% flat) independently of skin; everything else in "
            "rounds 1–2 is identical. Comparing the next stake between the two groups isolates the effect of the "
            "early win.",
        maths="""escalation_ratio = r2_amount / r1_amount   (defined only if r1_amount > 0)

Mann-Whitney U: H0: δ = 0, H1: δ > 0  (δ = P(E_win > E_flat) − P(E_win < E_flat))""",
        figures=["H2"], tables=[],
        overclaim="The early win is small (+8% of a virtual stake) and shown once; a null result does not rule "
                  "out larger or repeated early wins mattering in real apps.",
    ),
    "H3": dict(
        title="People trust faster when stakes are small", short="Small stakes",
        claim="Willingness to invest without verifying is highest at small amounts and falls as the amount rises.",
        prediction="At ₹500 players open the deal details least and invest most.",
        primary="H3.primary",
        secondary=["H3.sec.deal_invest", "H3.sec.deal_time", "H3.pair.details_500_vs_3000",
                   "H3.pair.details_500_vs_8000", "H3.pair.details_3000_vs_8000"],
        extra=["H3.order.details_by_position", "H3.order.invest_by_position"],
        how="Within-subject: every player saw all three flash deals (₹500, ₹3,000, ₹8,000) on one screen, in random "
            "card order, with the same +5% return and the same \"View details\" button. Each player is their own "
            "control, so differences across sizes come from the stake, not from who the player is. Card position "
            "is checked separately.",
        maths="""details_s = 1[details opened before investing / Continue] for s ∈ {500, 3000, 8000}

Cochran's Q = (k − 1)[k Σ C_j² − N²] / (k N − Σ R_i²),  k = 3,  df = 2
H0: P(details_500) = P(details_3000) = P(details_8000)
H1: the shares differ, with the lowest share at ₹500
Effect: η²_Q = Q / (n(k − 1));  pairwise exact McNemar (Holm);  Friedman χ²_F on times, Kendall's W""",
        figures=["H3"], tables=["H3_by_size", "H3_by_position"],
        overclaim="The deals were all affordable and all paid +5%, so the test is about checking habits, not "
                  "about risk; the ₹ amounts were virtual.",
    ),
    "H4": dict(
        title="Loss aversion drives loss chasing", short="Loss chasing",
        claim="After a scripted loss, participants with higher loss aversion are more likely to add money to recover "
              "their balance.",
        prediction="A higher loss-aversion group predicts topping up after the crash.",
        primary="H4.primary", secondary=["H4.sec.amount_ols", "H4.sec.amount_spearman"],
        extra=["H4.order.spin_order"],
        how="Loss aversion was measured behaviourally by two 50/50 spins (lose ₹100 / win ₹150 or ₹250, accept or "
            "skip) before the crash; the crash itself (−40%) is identical for everyone. The top-up decision after "
            "the crash is then related to the measured group, controlling for skin and investing experience. This "
            "is a correlational test inside the experiment (loss aversion was measured, not assigned).",
        maths="""loss_aversion_group: 1 = accepted both (λ ≤ 1.5), 2 = rejected 150, accepted 250 (1.5 < λ ≤ 2.5),
                     3 = rejected both (λ > 2.5)   [accept a 50/50 (−100, +X) bet iff X ≥ λ·100]

logit P(topup = 1) = β0 + β1·LA_group + β2·fraud + β3·exp_investing
H0: β1 = 0        H1: β1 > 0  (OR = e^β1 > 1)""",
        figures=["H4"], tables=["H4_group_distribution", "H4_logit", "H4_ols"],
        overclaim="Loss aversion was not randomized, so even a significant link would be an association; the "
                  "two-spin measure is coarse (three groups).",
    ),
    "H5": dict(
        title="A friend's referral lowers verification", short="Friend referral",
        claim="The same app is joined more readily, and checked less, when a friend refers it than when it appears "
              "as an ad.",
        prediction="More players join the Diamond Pool when the invite comes from a friend.",
        primary="H5.primary", secondary=["H5.sec.pool_details", "H5.sec.pool_time"], extra=["H5.mod.friend_x_fomo"],
        how="The same ₹2,000 pool (whose details reveal it pays from new members) was offered either as a WhatsApp "
            "message from a college friend or as a sponsored ad, randomized independently of skin. Only the source "
            "differs.",
        maths="""Fisher's exact test (source × pool_join): H0: OR = 1, H1: OR > 1 (friend vs ad)
pool_details: H1: OR < 1;  pool_time: Mann-Whitney U, H1: δ < 0
Moderator (exploratory): logit P(join) = β0 + β1·friend + β2·fomo + β3·friend·fomo""",
        figures=["H5"], tables=["H5_moderator_logit"],
        overclaim="The \"friend\" was a fictional character in a game; a real friend's referral carries far more "
                  "trust, so the lab manipulation is weak by design.",
    ),
    "H6": dict(
        title="A small successful withdrawal builds trust", short="Test withdrawal",
        claim="Participants allowed one small withdrawal deposit more afterwards than those not offered a "
              "withdrawal.",
        prediction="Players offered the ₹500 test withdrawal deposit more right after it.",
        primary="H6.primary", secondary=["H6.sec.app_trust"], extra=["H6.sec.withdrew"],
        how="Whether a ₹500 test withdrawal was offered was randomized independently of skin. Everyone then saw the "
            "same offer to deposit up to ₹5,000. The analysis is intention-to-treat on the offer.",
        maths="""Mann-Whitney U on post_withdrawal_deposit (allowed vs not offered)
H0: δ = 0        H1: δ > 0""",
        figures=["H6"], tables=[],
        overclaim="Trust was rated once at the end, after many later events, so it is a noisy measure of trust "
                  "right after the withdrawal.",
    ),
    "H7": dict(
        title="App profits are treated as house money", short="House money",
        claim="Participants reinvest profits shown in the app more freely than an equal amount of their own fresh "
              "money.",
        prediction="More is put into the Gold Plan when it is funded from the Profit wallet than from Main.",
        primary="H7.primary", secondary=["H7.sec.reinvest_accept"],
        how="The Gold Plan offer (₹0–2,000, slider starting at ₹0, always affordable) was framed as coming from the "
            "Profit wallet or from the Main wallet, randomized independently of skin. Only the source of the money "
            "differs.",
        maths="""Mann-Whitney U on reinvest_amount (profit vs main): H0: δ = 0, H1: δ > 0
Fisher's exact test on reinvest_accept: H0: OR = 1, H1: OR > 1""",
        figures=["H7"], tables=[],
        overclaim="Both wallets hold virtual money that players were given, so \"own money\" is only a framing; "
                  "the house-money effect on real savings is not tested.",
    ),
    "H8": dict(
        title="Financial literacy does not protect against fraud", short="Literacy paradox",
        claim="Financial literacy does not reduce fraud susceptibility, while overconfidence (perceived minus actual "
              "literacy) increases it.",
        prediction="Literacy coefficient not negative; overconfidence coefficient positive.",
        primary="H8.primary", secondary=["H8.literacy"], extra=["H8.dataset"], kind="h8",
        how="App part: literacy (Big Three items, incentivized at ₹100 each) and self-rated money skill (asked "
            "before the game) are measured, and the number of shared traps fallen for is the susceptibility "
            "outcome. This is correlational. Dataset part: the same idea on real fraud in two US population surveys "
            "(NFCS 2024). The Investor Survey (investment fraud; primary model, fixed before fitting) measures an "
            "11-item investing-knowledge quiz and self-rated investing knowledge; the State-by-State Survey (any "
            "financial fraud; large-sample check) measures the Big Three and self-rated financial knowledge. "
            "Survey-weighted logistic regressions relate knowledge and overconfidence to being targeted, losing "
            "money, wanting a 'guaranteed 25%' offer and checking a regulator. Measured, not assigned: these are "
            "associations, not causal effects.",
        maths="""overconfidence = z(self_rated_literacy) − z(literacy_score),  z = (x − x̄)/s over the 61 completers
trap_score_shared8 = β0 + β1·literacy + β2·overconfidence + β3·fin_edu + β4·fraud + β5·exp_investing + ε
H0: β2 = 0 (and β1 < 0: literacy protects)
H1: β2 > 0 and β1 ≥ 0     (HC3 robust SEs)
Note: with literacy in the model, β2 is the effect of a higher self-rating at equal literacy.

NFCS (dataset part), survey-weighted logistic regression, HC1 SEs, odds ratios per SD:
logit P(victim) = α + a·z(lit) + b·z(OC) + controls,   OC = z(self) − z(lit)
H0: e^b = 1 (and e^a < 1: literacy protects)     H1: e^b > 1 and the CI of e^a not entirely below 1

Reparameterization (same model, same fit):
a·z(lit) + b·(z(self) − z(lit)) = (a − b)·z(lit) + b·z(self)
→ with OC in the model, a = literacy at equal overconfidence;
  with z(self) in the model, (a − b) = literacy at equal self-rating.
  (OC is standardized here, so b above is our coefficient divided by SD(OC).)""",
        figures=["H8"], dataset_figures=["external_H8"], tables=["H8_literacy_distribution", "H8_ols"],
        overclaim="The app part is correlational: literacy and self-rating were measured, not assigned, and the "
                  "trap score counts choices in a game, not real victimization.",
    ),
    "H9": dict(
        title="The dominant bias differs by demographic group", short="Bias by group",
        claim="The bias that best predicts victimization differs across age, gender and income groups.",
        prediction="Bias slopes on the trap score differ between male and not-male players (app); by age, income "
                   "and gender for victimization (dataset).",
        primary=None, extra=["H9.app.la_group_x_male", "H9.app.fomo_score_x_male", "H9.app.overconfidence_x_male",
                             "H9.app.crt_correct_x_male", "H9.dataset"], kind="h9",
        how="App part (exploratory): the trap score is regressed on four measured biases (loss aversion, FOMO, "
            "overconfidence, CRT) and their interactions with gender. Age and income cannot be tested: almost all "
            "app players are 18–20 students. Main test: the NFCS 2024 State-by-State Survey (about 19,000 US "
            "adults). For gender, age group and income group, a joint Wald test asks whether the effects of the "
            "bias proxies (overconfidence, risk willingness) differ between groups; models within each group name "
            "the strongest bias. Primary outcome (fixed before fitting): lost money to a fraud.",
        maths="""trap_score_shared8 = β0 + Σ_b β_b·bias_b + γ·male + Σ_b δ_b·bias_b·male + ε   (HC3)
slope_b(not male) = β_b,   slope_b(male) = β_b + δ_b
H0: δ_b = 0 for each bias    (exploratory; no verdict beyond EXPLORATORY)

NFCS: logit P(lost money) = α + Σ_b β_b·bias_b + Σ_g γ_g·group_g + Σ_b Σ_g δ_bg·bias_b·group_g + controls
bias ∈ {z(overconfidence), z(risk willingness)};  group ∈ gender | age | income
H0: all δ_bg = 0 (joint Wald test, Holm over the three groupings)""",
        figures=["H9"], dataset_figures=["external_H9"], tables=["H9_ols", "H9_simple_slopes"],
        overclaim="With few non-male players and ten parameters, the app model cannot establish group differences; "
                  "any pattern here is a hypothesis for the dataset part, not a finding.",
    ),
}
