/**
 * Compact worked example for the plan prompt (BRIEF: put the example day in the plan prompt).
 * Numbers and shape mirror scenarios/example/example-bundle-zippy-medium.json — not a full dump.
 */
export const WORKED_EXAMPLE_DAY = `WORKED EXAMPLE (shape and discipline — invent a NEW company and problem for the learner's job; do not copy Zippy Café):
{
  "track": {
    "id": "try-product-manager",
    "title": "Product Manager at Zippy",
    "role": "Product Manager",
    "company": {
      "name": "Zippy",
      "one_liner": "Fictional Indian 10-minute grocery delivery; Café launched 8 weeks ago.",
      "world_briefing": "300 dark stores; Café in 60 (42 Bengaluru, 18 Pune). 30-day repeat 14% vs 30% target. Dashboard BLR/Pune/target: orders/day 9800/3100; first-timers 160000/52000; repeat 16%/10%/30%; delivery 14/17/10 min; discount orders 62%/71%/<40%; complaints 6%/11%/<3%; margin −₹18/−₹31/break-even."
    },
    "skills": [{"id":"framing","name":"Problem framing","description":"..."}, "...exactly 6..."],
    "cast": [
      {"id":"meera","name":"Meera Rao","role":"VP Product, your boss","kind":"colleague","cares_about":"Evidence","persona":"Sharp boss; never gives the answer."},
      {"id":"lakshmi","name":"Lakshmi","role":"Data Analyst","kind":"colleague","cares_about":"Precise questions","persona":"Only precise questions get numbers."},
      {"id":"aditya","name":"Aditya","role":"Growth Head","kind":"colleague","cares_about":"Volume","persona":"Pushes discounts; accepts a measured test."},
      {"id":"sana","name":"Sana","role":"Café Ops","kind":"colleague","cares_about":"Kitchens","persona":"Practical, stretched."},
      {"id":"karthik","name":"Karthik","role":"Eng Lead","kind":"colleague","cares_about":"Roadmap","persona":"App changes take weeks."}
    ],
    "mentor": {"name":"Nandita","title":"Senior PM, your mentor","years":12},
    "style_rules": "1–4 line workplace chat; never mention AI."
  },
  "day": {
    "title": "Diagnose low repeat orders",
    "theme": "Find why customers try once and don't return.",
    "story_so_far": "Player's first day at Zippy.",
    "world_today": "Leadership reviews Café in three weeks.",
    "canon_after_day": "Team accepts bad first orders + coupon hunters drive weak repeat.",
    "characters": [
      {"id":"meera","available":"start","today":"...","hidden_facts":[]},
      {"id":"lakshmi","available":"start","limits":{"data_pulls":18},"reply_flags":["returned_data"],
        "hidden_facts":[
          {"id":"h1","fact":"Coupon first-timers: 8% repeat; full-price: 28%.","reveal_if":"asks coupon vs full-price repeat"},
          {"id":"h2","fact":"Morning BLR delivery avg 19 min when kitchen queue >12.","reveal_if":"asks morning delivery or queue"},
          {"id":"h3","fact":"Pune cold-coffee complaints 3× Bengaluru.","reveal_if":"asks Pune complaints or cold drinks"},
          {"id":"h4","fact":"50%-off push drove 40% of first orders last week.","reveal_if":"asks what drove first orders"}
        ]},
      {"id":"aditya","available":"locked","today":"Will push a blanket 50% campaign.","hidden_facts":[]}
    ],
    "public": {
      "inbox": [{"from":"meera","time":"09:02","subject":"Welcome","body":"Repeat is 14% vs 30%. Send a first read by EOD. Ask Lakshmi precise questions."}],
      "dashboard": {"title":"Café","columns":["Metric","BLR","Pune","Target"],"rows":[{"cells":["30-day repeat","16%","10%","30%"],"miss":true},"...≥4 rows..."],"notes":["48% of orders 8–11am"]},
      "reviews":[{"text":"Coffee lukewarm.","meta":"Pune · ★★"}]
    },
    "tasks": [
      {"id":"t1","kind":"submission","submit_to":"meera","title":"First read","done_when":{"submitted":"t1"}},
      {"id":"t2","kind":"chat","title":"Pull data","done_when":{"counter_at_least":{"counter":"lakshmi.data_pulls","value":1}}},
      {"id":"t3","kind":"chat","title":"Handle Growth ask","done_when":{"messages_sent":{"to":"aditya","at_least":1}}},
      {"id":"t4","kind":"submission","submit_to":"meera","title":"Decision note","done_when":{"submitted":"t4"}}
    ],
    "triggers": [
      {"id":"twist","when":{"any":[{"all":[{"submitted":"t1"},{"counter_at_least":{"counter":"lakshmi.data_pulls","value":1}}]},{"counter_at_least":{"counter":"lakshmi.data_pulls","value":2}}]},
        "do":[{"unlock":"aditya"},{"message":{"from":"aditya","text":"Let's blast 50% off to everyone this weekend."}}]}
    ],
    "scoring": {
      "expected_answers": {
        "t1": "Weak repeat driven by coupon hunters + slow/cold first orders.",
        "t2": "At least one precise pull that separates segments.",
        "t3": "Push back; propose a small measured test with a kill metric.",
        "t4": "Clear recommendation with evidence and next step."
      },
      "strong_player": "Segments the problem; refuses blanket discount.",
      "common_mistakes": ["Averages only", "Agrees to blanket 50% off"],
      "senior_view": "Fix first-order quality before buying more first-timers.",
      "drill": "Write three precise data questions for an analyst."
    }
  },
  "ledger": [
    {"id":"rep_blr","label":"BLR 30-day repeat %","value":16},
    {"id":"rep_pune","label":"Pune 30-day repeat %","value":10},
    {"id":"rep_avg","label":"Weighted repeat %","value":14,"formula":"(rep_blr*160000+rep_pune*52000)/(160000+52000)"},
    {"id":"target","label":"Repeat target %","value":30},
    {"id":"gap","label":"Gap to target pp","value":16,"formula":"target-rep_avg"},
    {"id":"disc_blr","label":"BLR discount-order %","value":62}
  ],
  "claims": [
    {"text":"Repeat is below target","left":"rep_avg","op":"<","right":"target"},
    {"text":"Bengaluru repeats better than Pune","left":"rep_blr","op":">","right":"rep_pune"},
    {"text":"Gap to target is over 10pp","left":"gap","op":">","right":"10"}
  ]
}`;
