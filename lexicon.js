window.VIMSIKA_LEXICON = {
  schemaVersion: "1.0",
  label: "Viṃśikā working glossary",
  status: "draft",
  description: "Curated starter entries for close reading. Equivalents are conventional lexical aids, not reviewed token-level translation alignments.",
  entries: [
    {
      id: "san-vijnapti",
      lemma: "vijñapti",
      partOfSpeech: "NOUN",
      gender: "feminine",
      gloss: "making known; representation; cognitive appearance",
      forms: ["vijñapti", "vijñaptiḥ", "vijñaptir", "vijñaptiś", "vijñaptim", "vijñaptiṃ", "vijñaptinā", "vijñaptau", "vijñapteḥ", "vijñaptayaḥ"],
      morphology: {
        "vijñaptiḥ": "Case=Nom|Number=Sing|Gender=Fem",
        "vijñaptir": "Case=Nom|Number=Sing|Gender=Fem",
        "vijñaptiś": "Case=Nom|Number=Sing|Gender=Fem",
        "vijñaptim": "Case=Acc|Number=Sing|Gender=Fem",
        "vijñaptiṃ": "Case=Acc|Number=Sing|Gender=Fem",
        "vijñaptinā": "Case=Ins|Number=Sing|Gender=Fem",
        "vijñaptau": "Case=Loc|Number=Sing|Gender=Fem",
        "vijñapteḥ": "Case=Abl,Gen|Number=Sing|Gender=Fem",
        "vijñaptayaḥ": "Case=Nom,Acc|Number=Plur|Gender=Fem"
      },
      equivalents: {
        en: ["representation", "cognition", "making known"],
        bo: ["rnam par rig pa"],
        zh: ["了別", "識"]
      },
      note: "In this treatise, distinguish vijñapti from vijñāna where the argument depends on that distinction; Chinese and English renderings vary by translator."
    },
    {
      id: "san-vijnaptimatra",
      lemma: "vijñaptimātra",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "representation-only; cognition-only; nothing but representation",
      analysis: "vijñapti + mātra",
      forms: ["vijñaptimātra", "vijñaptimātraṃ", "vijñaptimātram", "vijñaptimātreṇa", "vijñaptimātrāt", "vijñaptimātrasya", "vijñaptimātre"],
      morphology: {
        "vijñaptimātraṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "vijñaptimātram": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "vijñaptimātreṇa": "Case=Ins|Number=Sing|Gender=Neut",
        "vijñaptimātrāt": "Case=Abl|Number=Sing|Gender=Neut",
        "vijñaptimātrasya": "Case=Gen|Number=Sing|Gender=Neut",
        "vijñaptimātre": "Case=Loc|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["representation-only", "cognition-only", "mere representation"],
        bo: ["rnam par rig pa tsam"],
        zh: ["唯識"]
      },
      note: "A technical compound. ‘Consciousness-only’ is also common in modern translations, but can obscure the difference between vijñapti and vijñāna."
    },
    {
      id: "san-citta",
      lemma: "citta",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "mind; thought; mental continuum",
      forms: ["citta", "cittaṃ", "cittam", "citte", "cittena", "cittāt", "cittasya", "cittāni", "cittamātra", "cittamātraṃ", "cittamātram"],
      morphology: {
        "cittaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "cittam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "citte": "Case=Loc|Number=Sing|Gender=Neut",
        "cittena": "Case=Ins|Number=Sing|Gender=Neut",
        "cittāt": "Case=Abl|Number=Sing|Gender=Neut",
        "cittasya": "Case=Gen|Number=Sing|Gender=Neut",
        "cittāni": "Case=Nom,Acc|Number=Plur|Gender=Neut",
        "cittamātraṃ": "Compound=citta+mātra|Case=Nom,Acc|Number=Sing|Gender=Neut",
        "cittamātram": "Compound=citta+mātra|Case=Nom,Acc|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["mind", "thought", "mentation"],
        bo: ["sems"],
        zh: ["心"]
      },
      note: "The opening commentary lists citta, manas, vijñāna and vijñapti as paryāyas; this does not erase their different uses elsewhere."
    },
    {
      id: "san-manas",
      lemma: "manas",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "mind; mental faculty; thought",
      forms: ["manas", "manaḥ", "mano", "manāḥ", "manasā", "manase", "manasaḥ", "manodaṇḍaḥ", "manodaṇḍo", "manodaṇḍaṃ"],
      morphology: {
        "manaḥ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "mano": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "manasā": "Case=Ins|Number=Sing|Gender=Neut",
        "manase": "Case=Dat|Number=Sing|Gender=Neut",
        "manasaḥ": "Case=Abl,Gen|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["mind", "mental faculty"],
        bo: ["yid"],
        zh: ["意"]
      },
      note: "Compounds beginning with mano- are not necessarily occurrences of the independent noun manas."
    },
    {
      id: "san-vijnana",
      lemma: "vijñāna",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "consciousness; discernment; cognition",
      forms: ["vijñāna", "vijñānaṃ", "vijñānam", "vijñānāt", "vijñānasya", "vijñāne", "vijñānena", "vijñānāni"],
      morphology: {
        "vijñānaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "vijñānam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "vijñānāt": "Case=Abl|Number=Sing|Gender=Neut",
        "vijñānasya": "Case=Gen|Number=Sing|Gender=Neut",
        "vijñāne": "Case=Loc|Number=Sing|Gender=Neut",
        "vijñānena": "Case=Ins|Number=Sing|Gender=Neut",
        "vijñānāni": "Case=Nom,Acc|Number=Plur|Gender=Neut"
      },
      equivalents: {
        en: ["consciousness", "cognition", "discernment"],
        bo: ["rnam par shes pa"],
        zh: ["識", "了別"]
      },
      note: "Compare the corresponding Tibetan rnam par shes pa with rnam par rig pa for vijñapti."
    },
    {
      id: "san-artha",
      lemma: "artha",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "object; referent; thing; meaning; purpose",
      forms: ["artha", "arthaḥ", "artho", "arthaṃ", "artham", "arthena", "arthāt", "arthasya", "arthe", "arthān", "arthaiḥ", "arthāḥ", "arthānāṃ", "nārthataḥ"],
      morphology: {
        "arthaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "artho": "Case=Nom|Number=Sing|Gender=Masc",
        "arthaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "artham": "Case=Acc|Number=Sing|Gender=Masc",
        "arthena": "Case=Ins|Number=Sing|Gender=Masc",
        "arthāt": "Case=Abl|Number=Sing|Gender=Masc",
        "arthasya": "Case=Gen|Number=Sing|Gender=Masc",
        "arthe": "Case=Loc|Number=Sing|Gender=Masc",
        "arthān": "Case=Acc|Number=Plur|Gender=Masc",
        "arthaiḥ": "Case=Ins|Number=Plur|Gender=Masc",
        "arthāḥ": "Case=Nom|Number=Plur|Gender=Masc"
      },
      equivalents: {
        en: ["object", "referent", "thing", "meaning"],
        bo: ["don"],
        zh: ["義", "境", "事"]
      },
      note: "‘Object’ is often philosophically apt in the Viṃśikā, but artha also means meaning, aim or wealth in other settings."
    },
    {
      id: "san-traidhatuka",
      lemma: "traidhātuka",
      partOfSpeech: "ADJ",
      gloss: "belonging to the three realms; the triple world",
      analysis: "tri + dhātu + ka",
      forms: ["traidhātuka", "traidhātukaṃ", "traidhātukam", "traidhātukasya", "traidhātuke"],
      morphology: {
        "traidhātukaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "traidhātukam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "traidhātukasya": "Case=Gen|Number=Sing|Gender=Masc,Neut",
        "traidhātuke": "Case=Loc|Number=Sing|Gender=Masc,Neut"
      },
      equivalents: {
        en: ["the three realms", "the triple world"],
        bo: ["khams gsum", "khams gsum pa"],
        zh: ["三界"]
      },
      note: "Conventionally the desire, form and formless realms."
    },
    {
      id: "san-mahayana",
      lemma: "mahāyāna",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "Great Vehicle; Mahāyāna",
      forms: ["mahāyāna", "mahāyānaṃ", "mahāyānam", "māhāyāne", "mahāyāne", "mahāyānāt", "mahāyānasya"],
      morphology: {
        "māhāyāne": "Case=Loc|Number=Sing|Gender=Neut|Variant=sandhi or orthographic",
        "mahāyāne": "Case=Loc|Number=Sing|Gender=Neut",
        "mahāyānaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "mahāyānam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "mahāyānāt": "Case=Abl|Number=Sing|Gender=Neut",
        "mahāyānasya": "Case=Gen|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["Mahāyāna", "Great Vehicle"],
        bo: ["theg pa chen po"],
        zh: ["大乘"]
      },
      note: "The Lévi witness reads māhāyāne in the opening sentence; the inspector preserves that surface rather than silently correcting it."
    },
    {
      id: "san-sutra",
      lemma: "sūtra",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "discourse; scripture; aphoristic text",
      forms: ["sūtra", "sūtraṃ", "sūtram", "sūtrāt", "sūtre", "sūtrasya"],
      morphology: {
        "sūtrāt": "Case=Abl|Number=Sing|Gender=Neut",
        "sūtre": "Case=Loc|Number=Sing|Gender=Neut",
        "sūtrasya": "Case=Gen|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["sūtra", "discourse", "scripture"],
        bo: ["mdo"],
        zh: ["經", "修多羅"]
      }
    },
    {
      id: "san-paryaya",
      lemma: "paryāya",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "synonym; equivalent expression; succession; occasion",
      forms: ["paryāya", "paryāyaḥ", "paryāyāḥ", "paryāyam", "paryāyaṃ", "paryāyeṇa", "paryāyāt", "paryāye"],
      morphology: {
        "paryāyāḥ": "Case=Nom|Number=Plur|Gender=Masc",
        "paryāyaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "paryāyeṇa": "Case=Ins|Number=Sing|Gender=Masc",
        "paryāye": "Case=Loc|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["synonym", "equivalent expression"],
        bo: ["rnam grangs"],
        zh: ["異名", "門"]
      },
      note: "In the opening list, paryāyāḥ marks equivalent expressions in this context, not a universal claim of absolute synonymy."
    },
    {
      id: "san-matra",
      lemma: "mātra",
      partOfSpeech: "NOUN",
      gloss: "only; mere; measure; limiting element",
      forms: ["mātra", "mātraṃ", "mātram", "matram", "mātreṇa", "mātrāt"],
      morphology: {
        "mātraṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "mātram": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "matram": "Case=Nom,Acc|Number=Sing|Gender=Neut|Variant=surface spelling"
      },
      equivalents: {
        en: ["only", "mere", "nothing but"],
        bo: ["tsam"],
        zh: ["唯", "但"]
      },
      note: "Often occurs at the end of compounds, where it restricts the preceding term."
    },
    {
      id: "san-darsana",
      lemma: "darśana",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "seeing; vision; appearance; view; doctrine",
      forms: ["darśana", "darśanaṃ", "darśanam", "darśane", "darśanāt", "darśanasya"],
      morphology: {
        "darśanaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "darśanam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "darśane": "Case=Loc|Number=Sing|Gender=Neut",
        "darśanāt": "Case=Abl|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["seeing", "appearance", "view"],
        bo: ["mthong ba", "snang ba", "lta ba"],
        zh: ["見", "觀"]
      }
    },
    {
      id: "san-root-drs",
      lemma: "√dṛś",
      partOfSpeech: "VERB",
      gloss: "see; look; perceive; be seen",
      forms: ["dṛś", "dṛśyate", "dṛśyante", "paśyati", "paśyanti", "dadarśa", "dṛṣṭvā"],
      morphology: {
        "dṛśyate": "VerbForm=Fin|Mood=Ind|Tense=Pres|Voice=Pass|Person=3|Number=Sing",
        "dṛśyante": "VerbForm=Fin|Mood=Ind|Tense=Pres|Voice=Pass|Person=3|Number=Plur",
        "paśyati": "VerbForm=Fin|Mood=Ind|Tense=Pres|Voice=Act|Person=3|Number=Sing",
        "paśyanti": "VerbForm=Fin|Mood=Ind|Tense=Pres|Voice=Act|Person=3|Number=Plur",
        "dṛṣṭvā": "VerbForm=Conv"
      },
      equivalents: {
        en: ["see", "perceive", "be seen"],
        bo: ["mthong ba", "gzigs pa"],
        zh: ["見", "觀"]
      },
      note: "The present active forms come from paśyati; the passive forms use dṛśyate."
    },
    {
      id: "san-desa",
      lemma: "deśa",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "place; location; region",
      forms: ["deśa", "deśaḥ", "deśe", "deśāt", "deśasya", "deśādiniyamaḥ"],
      morphology: {
        "deśaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "deśe": "Case=Loc|Number=Sing|Gender=Masc",
        "deśāt": "Case=Abl|Number=Sing|Gender=Masc",
        "deśādiniyamaḥ": "Compound=deśa+ādi+niyama|Case=Nom|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["place", "location", "region"],
        bo: ["yul", "gnas"],
        zh: ["處", "方"]
      }
    },
    {
      id: "san-kala",
      lemma: "kāla",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "time; occasion; proper time",
      forms: ["kāla", "kālaḥ", "kāle", "kālāt", "kālasya"],
      morphology: {
        "kālaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "kāle": "Case=Loc|Number=Sing|Gender=Masc",
        "kālāt": "Case=Abl|Number=Sing|Gender=Masc",
        "kālasya": "Case=Gen|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["time", "occasion"],
        bo: ["dus"],
        zh: ["時"]
      }
    },
    {
      id: "san-niyama",
      lemma: "niyama",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "restriction; determination; regularity; fixed order",
      forms: ["niyama", "niyamaḥ", "niyamo", "niyamam", "niyamaṃ", "niyamāt", "niyamasya", "niyame", "deśakālaniyamaḥ", "saṃtānāniyamaḥ", "saṃtānāniyamo", "vijñaptiniyamaḥ", "vijñaptiniyamo"],
      morphology: {
        "niyamaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "niyamo": "Case=Nom|Number=Sing|Gender=Masc",
        "niyamāt": "Case=Abl|Number=Sing|Gender=Masc",
        "niyame": "Case=Loc|Number=Sing|Gender=Masc",
        "deśakālaniyamaḥ": "Compound=deśa+kāla+niyama|Case=Nom|Number=Sing|Gender=Masc",
        "saṃtānāniyamaḥ": "Compound=saṃtāna+aniyama|Case=Nom|Number=Sing|Gender=Masc",
        "saṃtānāniyamo": "Compound=saṃtāna+aniyama|Case=Nom|Number=Sing|Gender=Masc",
        "vijñaptiniyamaḥ": "Compound=vijñapti+niyama|Case=Nom|Number=Sing|Gender=Masc",
        "vijñaptiniyamo": "Compound=vijñapti+niyama|Case=Nom|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["restriction", "determination", "regularity"],
        bo: ["nge par 'jog pa", "rnam par gzhag pa"],
        zh: ["決定", "限定", "規則"]
      },
      note: "The Tibetan and Chinese renderings are context-sensitive; consult the aligned sentence rather than treating every listed equivalent as interchangeable."
    },
    {
      id: "san-krtyakriya",
      lemma: "kṛtyakriyā",
      partOfSpeech: "NOUN",
      gender: "feminine",
      gloss: "activity; performance of a function; efficacy",
      analysis: "kṛtya + kriyā",
      forms: ["kṛtyakriyā", "kṛtyakriyāṃ", "kṛtyakriyām", "kṛtyakriyayā", "kṛtyakriyāyāḥ"],
      morphology: {
        "kṛtyakriyā": "Case=Nom|Number=Sing|Gender=Fem",
        "kṛtyakriyāṃ": "Case=Acc|Number=Sing|Gender=Fem",
        "kṛtyakriyayā": "Case=Ins|Number=Sing|Gender=Fem"
      },
      equivalents: {
        en: ["activity", "efficacy", "performance of a function"],
        bo: ["bya ba byed pa", "don byed pa"],
        zh: ["作用", "事業"]
      }
    },
    {
      id: "san-svapna",
      lemma: "svapna",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "dream; sleep",
      forms: ["svapna", "svapnaḥ", "svapne", "svapnāt", "svapnasya", "svapnavat", "svapnopaghātavat", "svapnadṛk", "svapnādau"],
      morphology: {
        "svapnaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "svapne": "Case=Loc|Number=Sing|Gender=Masc",
        "svapnāt": "Case=Abl|Number=Sing|Gender=Masc",
        "svapnādau": "Case=Loc|Number=Sing|Gender=Masc|Derivation=svapna+ādi",
        "svapnavat": "Derivation=comparison|Gloss=like a dream",
        "svapnadṛk": "Compound=svapna+dṛś|Gloss=dream-seeing"
      },
      equivalents: {
        en: ["dream", "sleep"],
        bo: ["rmi lam"],
        zh: ["夢"]
      }
    },
    {
      id: "san-preta",
      lemma: "preta",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "departed one; hungry ghost",
      forms: ["preta", "pretaḥ", "pretāḥ", "pretān", "pretānāṃ", "pretaiḥ", "pretavat"],
      morphology: {
        "pretaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "pretāḥ": "Case=Nom|Number=Plur|Gender=Masc",
        "pretān": "Case=Acc|Number=Plur|Gender=Masc",
        "pretānāṃ": "Case=Gen|Number=Plur|Gender=Masc",
        "pretaiḥ": "Case=Ins|Number=Plur|Gender=Masc"
      },
      equivalents: {
        en: ["hungry ghost", "preta"],
        bo: ["yi dwags"],
        zh: ["餓鬼"]
      }
    },
    {
      id: "san-naraka",
      lemma: "naraka",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "hell; hell-being; infernal realm",
      forms: ["naraka", "narakaḥ", "narake", "narakāt", "narakasya", "narakavat", "nārakāṇāṃ", "narakapālādidarśane"],
      morphology: {
        "narakaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "narake": "Case=Loc|Number=Sing|Gender=Masc",
        "nārakāṇāṃ": "Case=Gen|Number=Plur|Derivation=nāraka"
      },
      equivalents: {
        en: ["hell", "hell-being", "infernal realm"],
        bo: ["dmyal ba", "sems can dmyal ba"],
        zh: ["地獄", "那落迦"]
      }
    },
    {
      id: "san-samtana",
      lemma: "saṃtāna",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "continuum; stream; mental series",
      forms: ["saṃtāna", "saṃtānaḥ", "saṃtāne", "saṃtānāt", "saṃtānasya", "saṃtānānāṃ"],
      morphology: {
        "saṃtānaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "saṃtāne": "Case=Loc|Number=Sing|Gender=Masc",
        "saṃtānāt": "Case=Abl|Number=Sing|Gender=Masc",
        "saṃtānānāṃ": "Case=Gen|Number=Plur|Gender=Masc"
      },
      equivalents: {
        en: ["continuum", "mental stream", "series"],
        bo: ["rgyud", "rgyun"],
        zh: ["相續"]
      }
    },
    {
      id: "san-vasana",
      lemma: "vāsanā",
      partOfSpeech: "NOUN",
      gender: "feminine",
      gloss: "latent impression; habitual tendency; perfuming",
      forms: ["vāsanā", "vāsanāṃ", "vāsanām", "vāsanayā", "vāsanāyāḥ", "vāsanāḥ", "vāsanānāṃ"],
      morphology: {
        "vāsanā": "Case=Nom|Number=Sing|Gender=Fem",
        "vāsanāṃ": "Case=Acc|Number=Sing|Gender=Fem",
        "vāsanayā": "Case=Ins|Number=Sing|Gender=Fem",
        "vāsanāyāḥ": "Case=Abl,Gen|Number=Sing|Gender=Fem",
        "vāsanāḥ": "Case=Nom,Acc|Number=Plur|Gender=Fem"
      },
      equivalents: {
        en: ["latent impression", "habitual tendency", "perfuming"],
        bo: ["bag chags"],
        zh: ["習氣", "薰習"]
      }
    },
    {
      id: "san-karana",
      lemma: "kāraṇa",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "cause; reason; instrument; causal condition",
      forms: ["kāraṇa", "kāraṇaṃ", "kāraṇam", "kāraṇāt", "kāraṇasya", "kāraṇe", "kāraṇena", "kāraṇāni"],
      morphology: {
        "kāraṇaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "kāraṇam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "kāraṇāt": "Case=Abl|Number=Sing|Gender=Neut",
        "kāraṇasya": "Case=Gen|Number=Sing|Gender=Neut",
        "kāraṇe": "Case=Loc|Number=Sing|Gender=Neut",
        "kāraṇena": "Case=Ins|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["cause", "reason", "causal condition"],
        bo: ["rgyu", "rkyen"],
        zh: ["因", "原因"]
      }
    },
    {
      id: "san-phala",
      lemma: "phala",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "fruit; result; effect; karmic result",
      forms: ["phala", "phalaṃ", "phalam", "phalāt", "phalasya", "phale", "phalena", "phalāni"],
      morphology: {
        "phalaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "phalam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "phalāt": "Case=Abl|Number=Sing|Gender=Neut",
        "phalasya": "Case=Gen|Number=Sing|Gender=Neut",
        "phale": "Case=Loc|Number=Sing|Gender=Neut",
        "phalena": "Case=Ins|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["result", "effect", "fruit"],
        bo: ["'bras bu"],
        zh: ["果", "果報"]
      }
    },
    {
      id: "san-parinama",
      lemma: "pariṇāma",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "transformation; change; maturation",
      forms: ["pariṇāma", "pariṇāmaḥ", "pariṇāmo", "pariṇāmaṃ", "pariṇāmam", "pariṇāmāt", "pariṇāmasya", "pariṇāme"],
      morphology: {
        "pariṇāmaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "pariṇāmo": "Case=Nom|Number=Sing|Gender=Masc",
        "pariṇāmaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "pariṇāmāt": "Case=Abl|Number=Sing|Gender=Masc",
        "pariṇāme": "Case=Loc|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["transformation", "change", "maturation"],
        bo: ["yongs su gyur pa", "rnam par smin pa"],
        zh: ["轉變", "變化", "異熟"]
      }
    },
    {
      id: "san-pudgala",
      lemma: "pudgala",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "person; individual; pudgala",
      forms: ["pudgala", "pudgalaḥ", "pudgalaṃ", "pudgalam", "pudgalasya", "pudgalāt"],
      morphology: {
        "pudgalaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "pudgalaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "pudgalasya": "Case=Gen|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["person", "individual", "pudgala"],
        bo: ["gang zag"],
        zh: ["補特伽羅", "人"]
      }
    },
    {
      id: "san-nairatmya",
      lemma: "nairātmya",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "selflessness; absence of a self; non-self",
      forms: ["nairātmya", "nairātmyaṃ", "nairātmyam", "nairātmyāt", "nairātmyasya", "nairātmye"],
      morphology: {
        "nairātmyaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "nairātmyāt": "Case=Abl|Number=Sing|Gender=Neut",
        "nairātmye": "Case=Loc|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["selflessness", "absence of self", "non-self"],
        bo: ["bdag med pa"],
        zh: ["無我"]
      }
    },
    {
      id: "san-dharma",
      lemma: "dharma",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "phenomenon; factor; teaching; duty; law",
      forms: ["dharma", "dharmaḥ", "dharmo", "dharmaṃ", "dharmam", "dharmeṇa", "dharmasya", "dharmāt", "dharme", "dharmāḥ", "dharmāṇāṃ"],
      morphology: {
        "dharmaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "dharmo": "Case=Nom|Number=Sing|Gender=Masc",
        "dharmaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "dharmeṇa": "Case=Ins|Number=Sing|Gender=Masc",
        "dharmasya": "Case=Gen|Number=Sing|Gender=Masc",
        "dharme": "Case=Loc|Number=Sing|Gender=Masc",
        "dharmāḥ": "Case=Nom|Number=Plur|Gender=Masc",
        "dharmāṇāṃ": "Case=Gen|Number=Plur|Gender=Masc"
      },
      equivalents: {
        en: ["phenomenon", "factor", "teaching", "dharma"],
        bo: ["chos"],
        zh: ["法"]
      },
      note: "The appropriate English equivalent depends on whether dharma denotes phenomena, the teaching, or another sense."
    },
    {
      id: "san-pravesa",
      lemma: "praveśa",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "entry; entrance; penetration; understanding",
      forms: ["praveśa", "praveśaḥ", "praveśo", "praveśaṃ", "praveśam", "praveśāt", "praveśe", "pudgalanairātmyapraveśaḥ", "dharmanairātmyapraveśaḥ", "pudgalanairātmyapraveśo", "dharmanairātmyapraveśo"],
      morphology: {
        "praveśaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "praveśo": "Case=Nom|Number=Sing|Gender=Masc",
        "praveśaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "praveśe": "Case=Loc|Number=Sing|Gender=Masc",
        "pudgalanairātmyapraveśaḥ": "Compound=pudgala+nairātmya+praveśa|Case=Nom|Number=Sing|Gender=Masc",
        "pudgalanairātmyapraveśo": "Compound=pudgala+nairātmya+praveśa|Case=Nom|Number=Sing|Gender=Masc",
        "dharmanairātmyapraveśaḥ": "Compound=dharma+nairātmya+praveśa|Case=Nom|Number=Sing|Gender=Masc",
        "dharmanairātmyapraveśo": "Compound=dharma+nairātmya+praveśa|Case=Nom|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["entry", "penetration", "understanding"],
        bo: ["'jug pa", "rtogs pa"],
        zh: ["入", "悟入"]
      }
    },
    {
      id: "san-desana",
      lemma: "deśanā",
      partOfSpeech: "NOUN",
      gender: "feminine",
      gloss: "teaching; instruction; exposition",
      forms: ["deśanā", "deśanāṃ", "deśanām", "deśanayā", "deśanāyāḥ", "deśane", "deśanāḥ"],
      morphology: {
        "deśanā": "Case=Nom|Number=Sing|Gender=Fem",
        "deśanāṃ": "Case=Acc|Number=Sing|Gender=Fem",
        "deśanayā": "Case=Ins|Number=Sing|Gender=Fem",
        "deśanāyāḥ": "Case=Abl,Gen|Number=Sing|Gender=Fem"
      },
      equivalents: {
        en: ["teaching", "instruction", "exposition"],
        bo: ["bstan pa", "gsungs pa"],
        zh: ["教說", "說法"]
      }
    },
    {
      id: "san-ayatana",
      lemma: "āyatana",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "sense base; sphere; field of cognition",
      forms: ["āyatana", "āyatanaṃ", "āyatanam", "āyatanāt", "āyatanasya", "āyatane", "āyatanāni", "rūpādyāyatanāstitvaṃ", "dvividhāyatanatvena"],
      morphology: {
        "āyatanaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "āyatanāt": "Case=Abl|Number=Sing|Gender=Neut",
        "āyatane": "Case=Loc|Number=Sing|Gender=Neut",
        "āyatanāni": "Case=Nom,Acc|Number=Plur|Gender=Neut",
        "rūpādyāyatanāstitvaṃ": "Compound=rūpa+ādi+āyatana+astitva|Case=Nom,Acc|Number=Sing|Gender=Neut",
        "dvividhāyatanatvena": "Compound=dvividha+āyatana+tva|Case=Ins|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["sense base", "sphere", "base of cognition"],
        bo: ["skye mched"],
        zh: ["處", "入"]
      }
    },
    {
      id: "san-bija",
      lemma: "bīja",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "seed; causal potential",
      forms: ["bīja", "bījaṃ", "bījam", "bījāt", "bījasya", "bīje", "bījāni", "svabījād", "svabījāt"],
      morphology: {
        "bījaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "bījāt": "Case=Abl|Number=Sing|Gender=Neut",
        "bījasya": "Case=Gen|Number=Sing|Gender=Neut",
        "bīje": "Case=Loc|Number=Sing|Gender=Neut",
        "svabījād": "Compound=sva+bīja|Case=Abl|Number=Sing|Gender=Neut",
        "svabījāt": "Compound=sva+bīja|Case=Abl|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["seed", "causal potential"],
        bo: ["sa bon"],
        zh: ["種子"]
      }
    },
    {
      id: "san-abhasa",
      lemma: "ābhāsa",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "appearance; semblance; shining forth",
      forms: ["ābhāsa", "ābhāsaḥ", "ābhāso", "ābhāsaṃ", "ābhāsam", "ābhāsāt", "ābhāsasya", "ābhāse", "yadābhāsā", "tadābhāsā", "vijñaptiyadābhāsā"],
      morphology: {
        "ābhāsaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "ābhāso": "Case=Nom|Number=Sing|Gender=Masc",
        "ābhāsaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "ābhāsāt": "Case=Abl|Number=Sing|Gender=Masc",
        "yadābhāsā": "Compound=yad+ābhāsa|Case=Nom|Number=Sing|Gender=Fem",
        "tadābhāsā": "Compound=tad+ābhāsa|Case=Nom|Number=Sing|Gender=Fem"
      },
      equivalents: {
        en: ["appearance", "semblance", "appearing as"],
        bo: ["snang ba", "'char ba"],
        zh: ["現", "似", "顯現"]
      }
    },
    {
      id: "san-paramanu",
      lemma: "paramāṇu",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "atom; infinitesimal particle",
      forms: ["paramāṇu", "paramāṇuḥ", "paramāṇur", "paramāṇuś", "paramāṇum", "paramāṇuṃ", "paramāṇoḥ", "paramāṇor", "paramāṇunā", "paramāṇavaḥ", "paramāṇūnāṃ", "aṇumātrakaḥ"],
      morphology: {
        "paramāṇuḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "paramāṇur": "Case=Nom|Number=Sing|Gender=Masc",
        "paramāṇuś": "Case=Nom|Number=Sing|Gender=Masc",
        "paramāṇum": "Case=Acc|Number=Sing|Gender=Masc",
        "paramāṇoḥ": "Case=Abl,Gen|Number=Sing|Gender=Masc",
        "paramāṇor": "Case=Abl,Gen|Number=Sing|Gender=Masc",
        "paramāṇunā": "Case=Ins|Number=Sing|Gender=Masc",
        "paramāṇavaḥ": "Case=Nom|Number=Plur|Gender=Masc",
        "paramāṇūnāṃ": "Case=Gen|Number=Plur|Gender=Masc"
      },
      equivalents: {
        en: ["atom", "infinitesimal particle"],
        bo: ["rdul phra rab", "rdul phran"],
        zh: ["極微", "微塵"]
      }
    },
    {
      id: "san-visaya",
      lemma: "viṣaya",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "object; object-field; domain; sense object",
      forms: ["viṣaya", "viṣayaḥ", "viṣayo", "viṣayaṃ", "viṣayam", "viṣayāt", "viṣayasya", "viṣaye", "viṣayāḥ", "svapnadṛgviṣayābhāvaṃ"],
      morphology: {
        "viṣayaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "viṣayo": "Case=Nom|Number=Sing|Gender=Masc",
        "viṣayaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "viṣayāt": "Case=Abl|Number=Sing|Gender=Masc",
        "viṣaye": "Case=Loc|Number=Sing|Gender=Masc",
        "viṣayāḥ": "Case=Nom|Number=Plur|Gender=Masc",
        "svapnadṛgviṣayābhāvaṃ": "Compound=svapna+dṛś+viṣaya+abhāva|Case=Acc|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["object", "object-field", "sense object"],
        bo: ["yul"],
        zh: ["境", "境界"]
      }
    },
    {
      id: "san-pratyaksa",
      lemma: "pratyakṣa",
      partOfSpeech: "ADJ",
      gloss: "directly perceived; perceptible; direct perception",
      forms: ["pratyakṣa", "pratyakṣaḥ", "pratyakṣaṃ", "pratyakṣam", "pratyakṣāt", "pratyakṣasya", "pratyakṣe", "pratyakṣatvaṃ", "pratyakṣatvam"],
      morphology: {
        "pratyakṣaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "pratyakṣaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "pratyakṣatvaṃ": "Derivation=pratyakṣa+tva|Case=Nom,Acc|Number=Sing|Gender=Neut",
        "pratyakṣatvam": "Derivation=pratyakṣa+tva|Case=Nom,Acc|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["direct perception", "perceptual", "immediately evident"],
        bo: ["mngon sum"],
        zh: ["現量", "現見"]
      }
    },
    {
      id: "san-buddhi",
      lemma: "buddhi",
      partOfSpeech: "NOUN",
      gender: "feminine",
      gloss: "awareness; cognition; understanding; intellect",
      forms: ["buddhi", "buddhiḥ", "buddhir", "buddhiś", "buddhim", "buddhiṃ", "buddhinā", "buddhau", "pratyakṣabuddhiḥ"],
      morphology: {
        "buddhiḥ": "Case=Nom|Number=Sing|Gender=Fem",
        "buddhir": "Case=Nom|Number=Sing|Gender=Fem",
        "buddhim": "Case=Acc|Number=Sing|Gender=Fem",
        "buddhinā": "Case=Ins|Number=Sing|Gender=Fem",
        "buddhau": "Case=Loc|Number=Sing|Gender=Fem",
        "pratyakṣabuddhiḥ": "Compound=pratyakṣa+buddhi|Case=Nom|Number=Sing|Gender=Fem"
      },
      equivalents: {
        en: ["awareness", "cognition", "understanding"],
        bo: ["blo", "shes pa"],
        zh: ["覺", "智", "了知"]
      },
      note: "Do not confuse the common noun buddhi with the proper epithet buddha."
    },
    {
      id: "san-smarana",
      lemma: "smaraṇa",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "remembering; memory; recollection",
      forms: ["smaraṇa", "smaraṇaṃ", "smaraṇam", "smaraṇāt", "smaraṇasya", "smaraṇe"],
      morphology: {
        "smaraṇaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "smaraṇāt": "Case=Abl|Number=Sing|Gender=Neut",
        "smaraṇe": "Case=Loc|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["memory", "recollection", "remembering"],
        bo: ["dran pa", "rjes su dran pa"],
        zh: ["憶", "念", "記憶"]
      }
    },
    {
      id: "san-smrti",
      lemma: "smṛti",
      partOfSpeech: "NOUN",
      gender: "feminine",
      gloss: "memory; recollection; mindfulness",
      forms: ["smṛti", "smṛtiḥ", "smṛtim", "smṛtiṃ", "smṛtyā", "smṛteḥ", "smṛtau", "smṛtilopādikāni", "smṛtilopādikānyeṣāṃ"],
      morphology: {
        "smṛtiḥ": "Case=Nom|Number=Sing|Gender=Fem",
        "smṛtim": "Case=Acc|Number=Sing|Gender=Fem",
        "smṛtyā": "Case=Ins|Number=Sing|Gender=Fem",
        "smṛteḥ": "Case=Abl,Gen|Number=Sing|Gender=Fem",
        "smṛtau": "Case=Loc|Number=Sing|Gender=Fem",
        "smṛtilopādikāni": "Compound=smṛti+lopa+ādi|Case=Nom,Acc|Number=Plur|Gender=Neut",
        "smṛtilopādikānyeṣāṃ": "Compound=smṛti+lopa+ādi|Case=Nom,Acc|Number=Plur|Gender=Neut"
      },
      equivalents: {
        en: ["memory", "recollection", "mindfulness"],
        bo: ["dran pa"],
        zh: ["念", "憶念"]
      }
    },
    {
      id: "san-jnana",
      lemma: "jñāna",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "knowledge; knowing; cognition; gnosis",
      forms: ["jñāna", "jñānaṃ", "jñānam", "jñānāt", "jñānasya", "jñāne", "jñānena", "svacittajñānaṃ"],
      morphology: {
        "jñānaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "jñānam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "jñānāt": "Case=Abl|Number=Sing|Gender=Neut",
        "jñāne": "Case=Loc|Number=Sing|Gender=Neut",
        "jñānena": "Case=Ins|Number=Sing|Gender=Neut",
        "svacittajñānaṃ": "Compound=sva+citta+jñāna|Case=Nom,Acc|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["knowledge", "knowing", "cognition"],
        bo: ["shes pa", "ye shes", "mkhyen pa"],
        zh: ["智", "知"]
      }
    },
    {
      id: "san-paracittavid",
      lemma: "paracittavid",
      partOfSpeech: "NOUN",
      gloss: "one who knows another's mind; knower of others' thoughts",
      analysis: "para + citta + vid",
      forms: ["paracittavid", "paracittavit", "paracittavidāṃ", "paracittavidbhiḥ"],
      morphology: {
        "paracittavit": "Case=Nom|Number=Sing|Derivation=agent noun",
        "paracittavidāṃ": "Case=Gen|Number=Plur|Derivation=agent noun",
        "paracittavidbhiḥ": "Case=Ins|Number=Plur|Derivation=agent noun"
      },
      equivalents: {
        en: ["knower of others' minds", "one who knows another's thoughts"],
        bo: ["gzhan gyi sems shes pa"],
        zh: ["知他心者", "他心智"]
      }
    },
    {
      id: "san-gocara",
      lemma: "gocara",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "range; domain; object-field; sphere of activity",
      forms: ["gocara", "gocaraḥ", "gocaro", "gocaraṃ", "gocaram", "gocarāt", "gocarasya", "gocare", "buddhagocaraḥ", "buddhagocaro"],
      morphology: {
        "gocaraḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "gocaro": "Case=Nom|Number=Sing|Gender=Masc",
        "gocaraṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "gocare": "Case=Loc|Number=Sing|Gender=Masc",
        "buddhagocaraḥ": "Compound=buddha+gocara|Case=Nom|Number=Sing|Gender=Masc",
        "buddhagocaro": "Compound=buddha+gocara|Case=Nom|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["domain", "range", "object-field"],
        bo: ["spyod yul"],
        zh: ["境界", "所行"]
      }
    },
    {
      id: "san-bahya",
      lemma: "bāhya",
      partOfSpeech: "ADJ",
      gloss: "external; outside; outer",
      forms: ["bāhya", "bāhyaḥ", "bāhyo", "bāhyaṃ", "bāhyam", "bāhyāt", "bāhyasya", "bāhye", "bāhyena"],
      morphology: {
        "bāhyaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "bāhyo": "Case=Nom|Number=Sing|Gender=Masc",
        "bāhyaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "bāhyāt": "Case=Abl|Number=Sing|Gender=Masc",
        "bāhye": "Case=Loc|Number=Sing|Gender=Masc",
        "bāhyena": "Case=Ins|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["external", "outer", "outside"],
        bo: ["phyi", "phyi rol"],
        zh: ["外", "外境"]
      }
    },
    {
      id: "san-siddhi",
      lemma: "siddhi",
      partOfSpeech: "NOUN",
      gender: "feminine",
      gloss: "establishment; proof; accomplishment; success",
      forms: ["siddhi", "siddhiḥ", "siddhir", "siddhiś", "siddhim", "siddhiṃ", "siddhinā", "siddhau", "vijñaptimātratāsiddhiḥ"],
      morphology: {
        "siddhiḥ": "Case=Nom|Number=Sing|Gender=Fem",
        "siddhir": "Case=Nom|Number=Sing|Gender=Fem",
        "siddhim": "Case=Acc|Number=Sing|Gender=Fem",
        "siddhinā": "Case=Ins|Number=Sing|Gender=Fem",
        "siddhau": "Case=Loc|Number=Sing|Gender=Fem",
        "vijñaptimātratāsiddhiḥ": "Compound=vijñapti+mātra+tā+siddhi|Case=Nom|Number=Sing|Gender=Fem"
      },
      equivalents: {
        en: ["establishment", "proof", "accomplishment"],
        bo: ["grub pa", "dngos grub"],
        zh: ["成立", "成就", "證成"]
      }
    },
    {
      id: "san-root-sidh",
      lemma: "√sidh",
      partOfSpeech: "VERB",
      gloss: "succeed; be established; be proved; accomplish",
      forms: ["sidh", "sidhyati", "sidhyanti", "siddha", "siddhaḥ", "siddhaṃ", "siddham", "siddhā", "siddhe"],
      morphology: {
        "sidhyati": "VerbForm=Fin|Mood=Ind|Tense=Pres|Voice=Pass|Person=3|Number=Sing",
        "sidhyanti": "VerbForm=Fin|Mood=Ind|Tense=Pres|Voice=Pass|Person=3|Number=Plur",
        "siddhaḥ": "VerbForm=Part|Tense=Past|Voice=Pass|Case=Nom|Number=Sing|Gender=Masc",
        "siddhaṃ": "VerbForm=Part|Tense=Past|Voice=Pass|Case=Nom,Acc|Number=Sing|Gender=Neut",
        "siddham": "VerbForm=Part|Tense=Past|Voice=Pass|Case=Nom,Acc|Number=Sing|Gender=Neut",
        "siddhā": "VerbForm=Part|Tense=Past|Voice=Pass|Case=Nom|Number=Sing|Gender=Fem",
        "siddhe": "VerbForm=Part|Tense=Past|Voice=Pass|Case=Loc|Number=Sing|Gender=Masc,Neut"
      },
      equivalents: {
        en: ["succeed", "be established", "be proved"],
        bo: ["grub pa", "'grub pa"],
        zh: ["成立", "成就", "證成"]
      }
    },
    {
      id: "san-rupa",
      lemma: "rūpa",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "form; visible form; matter; materiality",
      forms: ["rūpa", "rūpaṃ", "rūpam", "rūpāt", "rūpasya", "rūpe", "rūpāṇi"],
      morphology: {
        "rūpaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "rūpāt": "Case=Abl|Number=Sing|Gender=Neut",
        "rūpasya": "Case=Gen|Number=Sing|Gender=Neut",
        "rūpe": "Case=Loc|Number=Sing|Gender=Neut",
        "rūpāṇi": "Case=Nom,Acc|Number=Plur|Gender=Neut"
      },
      equivalents: {
        en: ["form", "visible form", "matter"],
        bo: ["gzugs"],
        zh: ["色"]
      }
    },
    {
      id: "san-sattva",
      lemma: "sattva",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "being; sentient being; existence; essence",
      forms: ["sattva", "sattvaḥ", "sattvo", "sattvaṃ", "sattvam", "sattvāt", "sattvasya", "sattve", "sattvāḥ", "sattvānāṃ", "upapādukasattvavat"],
      morphology: {
        "sattvaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "sattvo": "Case=Nom|Number=Sing|Gender=Masc",
        "sattvaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "sattve": "Case=Loc|Number=Sing|Gender=Masc",
        "sattvāḥ": "Case=Nom|Number=Plur|Gender=Masc",
        "sattvānāṃ": "Case=Gen|Number=Plur|Gender=Masc",
        "upapādukasattvavat": "Compound=upapāduka+sattva|Derivation=comparison|Gloss=like a spontaneously born being"
      },
      equivalents: {
        en: ["being", "sentient being", "existence"],
        bo: ["sems can", "srid pa"],
        zh: ["有情", "眾生", "有"]
      }
    },
    {
      id: "san-duhkha",
      lemma: "duḥkha",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "suffering; pain; unsatisfactoriness",
      forms: ["duḥkha", "duḥkhaṃ", "duḥkham", "duḥkhāt", "duḥkhasya", "duḥkhe", "duḥkhena", "duḥkhāni"],
      morphology: {
        "duḥkhaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "duḥkham": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "duḥkhāt": "Case=Abl|Number=Sing|Gender=Neut",
        "duḥkhe": "Case=Loc|Number=Sing|Gender=Neut",
        "duḥkhena": "Case=Ins|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["suffering", "pain", "unsatisfactoriness"],
        bo: ["sdug bsngal"],
        zh: ["苦", "苦受"]
      }
    },
    {
      id: "san-tadja",
      lemma: "tadja",
      partOfSpeech: "ADJ",
      gloss: "born from that; arising from it; resulting therefrom",
      analysis: "tad + ja",
      forms: ["tadja", "tadjaḥ", "tadjo", "tadjaṃ", "tajjaṃ", "tajjam", "tadjāt", "tajjāt", "tadjasya"],
      morphology: {
        "tadjaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "tadjo": "Case=Nom|Number=Sing|Gender=Masc",
        "tadjaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "tajjaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut|Variant=sandhi",
        "tajjam": "Case=Nom,Acc|Number=Sing|Gender=Neut|Variant=sandhi",
        "tajjāt": "Case=Abl|Number=Sing|Gender=Masc,Neut|Variant=sandhi"
      },
      equivalents: {
        en: ["born from that", "arising from it", "resulting therefrom"],
        bo: ["de las byung ba"],
        zh: ["彼所生", "從彼生"]
      }
    },
    {
      id: "san-atman",
      lemma: "ātman",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "self; soul; oneself; essential nature",
      forms: ["ātman", "ātmā", "ātmanaḥ", "ātmanā", "ātmane", "ātmānam", "ātmanam", "kalpitātmanā", "svātmanā"],
      morphology: {
        "ātmā": "Case=Nom|Number=Sing|Gender=Masc",
        "ātmanaḥ": "Case=Abl,Gen|Number=Sing|Gender=Masc",
        "ātmanā": "Case=Ins|Number=Sing|Gender=Masc",
        "ātmane": "Case=Dat|Number=Sing|Gender=Masc",
        "ātmānam": "Case=Acc|Number=Sing|Gender=Masc",
        "kalpitātmanā": "Compound=kalpita+ātman|Case=Ins|Number=Sing|Gender=Masc",
        "svātmanā": "Compound=sva+ātman|Case=Ins|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["self", "soul", "oneself"],
        bo: ["bdag", "bdag nyid"],
        zh: ["我", "自體"]
      }
    },
    {
      id: "san-asat",
      lemma: "asat",
      partOfSpeech: "ADJ",
      gloss: "non-existent; unreal; not being; bad",
      forms: ["asat", "asad", "asan", "asataḥ", "asatā", "asati"],
      morphology: {
        "asat": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "asad": "Case=Nom,Acc|Number=Sing|Gender=Neut|Variant=sandhi",
        "asataḥ": "Case=Abl,Gen|Number=Sing|Gender=Masc,Neut",
        "asatā": "Case=Ins|Number=Sing|Gender=Masc,Neut",
        "asati": "Case=Loc|Number=Sing|Gender=Masc,Neut"
      },
      equivalents: {
        en: ["non-existent", "unreal", "not being"],
        bo: ["med pa", "yin pa ma yin pa"],
        zh: ["無", "非有", "不實"]
      }
    },
    {
      id: "san-avabhasa",
      lemma: "avabhāsa",
      partOfSpeech: "NOUN",
      gender: "masculine",
      gloss: "appearance; manifestation; illumination",
      forms: ["avabhāsa", "avabhāsaḥ", "avabhāso", "avabhāsaṃ", "avabhāsam", "avabhāsāt", "avabhāse"],
      morphology: {
        "avabhāsaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "avabhāso": "Case=Nom|Number=Sing|Gender=Masc",
        "avabhāsaṃ": "Case=Acc|Number=Sing|Gender=Masc",
        "avabhāsam": "Case=Acc|Number=Sing|Gender=Masc",
        "avabhāsāt": "Case=Abl|Number=Sing|Gender=Masc",
        "avabhāse": "Case=Loc|Number=Sing|Gender=Masc"
      },
      equivalents: {
        en: ["appearance", "manifestation", "illumination"],
        bo: ["snang ba", "gsal ba"],
        zh: ["現", "顯現", "似現"]
      }
    },
    {
      id: "san-avabhasana",
      lemma: "avabhāsana",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "appearing; manifestation; making visible",
      forms: ["avabhāsana", "avabhāsanaṃ", "avabhāsanam", "avabhāsanāt", "avabhāsanasya", "avabhāsane", "asadarthāvabhāsanāt"],
      morphology: {
        "avabhāsanaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "avabhāsanam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "avabhāsanāt": "Case=Abl|Number=Sing|Gender=Neut",
        "avabhāsanasya": "Case=Gen|Number=Sing|Gender=Neut",
        "avabhāsane": "Case=Loc|Number=Sing|Gender=Neut",
        "asadarthāvabhāsanāt": "Compound=asat+artha+avabhāsana|Case=Abl|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["appearing", "manifestation", "making visible"],
        bo: ["snang ba", "gsal bar byed pa"],
        zh: ["顯現", "似現"]
      }
    },
    {
      id: "san-root-ava-bhas",
      lemma: "ava-√bhās",
      partOfSpeech: "VERB",
      gloss: "appear; shine forth; become visible",
      forms: ["avabhāsate", "avabhāsante", "avabhāseta", "avabhāsamāna"],
      morphology: {
        "avabhāsate": "VerbForm=Fin|Mood=Ind|Tense=Pres|Voice=Mid|Person=3|Number=Sing",
        "avabhāsante": "VerbForm=Fin|Mood=Ind|Tense=Pres|Voice=Mid|Person=3|Number=Plur",
        "avabhāseta": "VerbForm=Fin|Mood=Opt|Tense=Pres|Voice=Mid|Person=3|Number=Sing",
        "avabhāsamāna": "VerbForm=Part|Tense=Pres|Voice=Mid"
      },
      equivalents: {
        en: ["appear", "shine forth", "become visible"],
        bo: ["snang ba", "'char ba"],
        zh: ["顯現", "現起"]
      }
    },
    {
      id: "san-taimirika",
      lemma: "taimirika",
      partOfSpeech: "ADJ",
      gloss: "suffering from timira; affected by an eye disorder",
      forms: ["taimirika", "taimirikaḥ", "taimiriko", "taimirikaṃ", "taimirikam", "taimirikasya", "taimirikasyāsat", "taimirikāt", "taimirike", "taimirikaiḥ"],
      morphology: {
        "taimirikaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "taimiriko": "Case=Nom|Number=Sing|Gender=Masc",
        "taimirikasya": "Case=Gen|Number=Sing|Gender=Masc,Neut",
        "taimirikasyāsat": "Compound=taimirika+asat|Case=Gen|Number=Sing|Gender=Masc,Neut",
        "taimirikāt": "Case=Abl|Number=Sing|Gender=Masc",
        "taimirike": "Case=Loc|Number=Sing|Gender=Masc",
        "taimirikaiḥ": "Case=Ins|Number=Plur|Gender=Masc"
      },
      equivalents: {
        en: ["one with an eye disorder", "one suffering from timira"],
        bo: ["rab rib can"],
        zh: ["目眩者", "患翳者"]
      },
      note: "The simile concerns visual appearances experienced by someone with timira; translations specify the eye disorder in different ways."
    },
    {
      id: "san-karma",
      lemma: "karman",
      partOfSpeech: "NOUN",
      gender: "neuter",
      gloss: "action; deed; karma; ritual act",
      forms: ["karman", "karma", "karmaṇaḥ", "karmaṇo", "karmaṇā", "karmaṇi", "karmāṇi", "karmabhiḥ", "tatkarmabhiḥ"],
      morphology: {
        "karma": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "karmaṇaḥ": "Case=Abl,Gen|Number=Sing|Gender=Neut",
        "karmaṇo": "Case=Abl,Gen|Number=Sing|Gender=Neut",
        "karmaṇā": "Case=Ins|Number=Sing|Gender=Neut",
        "karmaṇi": "Case=Loc|Number=Sing|Gender=Neut",
        "karmāṇi": "Case=Nom,Acc|Number=Plur|Gender=Neut",
        "karmabhiḥ": "Case=Ins|Number=Plur|Gender=Neut",
        "tatkarmabhiḥ": "Compound=tad+karman|Case=Ins|Number=Plur|Gender=Neut"
      },
      equivalents: {
        en: ["action", "deed", "karma"],
        bo: ["las"],
        zh: ["業", "行為"]
      }
    },
    {
      id: "san-mithas",
      lemma: "mithas",
      partOfSpeech: "ADV",
      gloss: "mutually; reciprocally; with one another",
      forms: ["mithas", "mithaḥ"],
      morphology: {},
      equivalents: {
        en: ["mutually", "reciprocally"],
        bo: ["phan tshun", "gcig la gcig"],
        zh: ["互相", "彼此"]
      }
    },
    {
      id: "san-anyonya",
      lemma: "anyonya",
      partOfSpeech: "ADJ",
      gloss: "mutual; reciprocal; one another",
      forms: ["anyonya", "anyonyaṃ", "anyonyam", "anyonyasya", "anyonyāt", "anyonyādhipatitvena"],
      morphology: {
        "anyonyaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "anyonyam": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "anyonyasya": "Case=Gen|Number=Sing|Gender=Masc,Neut",
        "anyonyāt": "Case=Abl|Number=Sing|Gender=Masc,Neut",
        "anyonyādhipatitvena": "Compound=anyonya+adhipatitva|Case=Ins|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["mutual", "reciprocal", "one another"],
        bo: ["phan tshun", "gcig la gcig"],
        zh: ["互相", "彼此"]
      }
    },
    {
      id: "san-parasparam",
      lemma: "parasparam",
      partOfSpeech: "ADV",
      gloss: "mutually; reciprocally; with one another",
      forms: ["parasparam", "parasparaṃ"],
      morphology: {
        "parasparam": "Derivation=reciprocal relation|Gloss=mutually",
        "parasparaṃ": "Derivation=reciprocal relation|Gloss=mutually"
      },
      equivalents: {
        en: ["mutually", "reciprocally", "one another"],
        bo: ["phan tshun", "gcig la gcig"],
        zh: ["互相", "彼此"]
      }
    },
    {
      id: "san-sunya",
      lemma: "śūnya",
      partOfSpeech: "ADJ",
      gloss: "empty; void; devoid of",
      forms: ["śūnya", "śūnyaḥ", "śūnyo", "śūnyaṃ", "śūnyam", "śūnyāt", "śūnyasya", "śūnye", "śūnyatva", "śūnyatvaṃ", "śūnyatvam", "daṇḍakāraṇyaśūnyatvaṃ", "daṇḍakāraṇyaśūnyatvam"],
      morphology: {
        "śūnyaḥ": "Case=Nom|Number=Sing|Gender=Masc",
        "śūnyo": "Case=Nom|Number=Sing|Gender=Masc",
        "śūnyaṃ": "Case=Nom,Acc|Number=Sing|Gender=Neut",
        "śūnyatvaṃ": "Derivation=śūnya+tva|Case=Nom,Acc|Number=Sing|Gender=Neut",
        "śūnyatvam": "Derivation=śūnya+tva|Case=Nom,Acc|Number=Sing|Gender=Neut",
        "daṇḍakāraṇyaśūnyatvaṃ": "Compound=daṇḍaka+araṇya+śūnyatva|Case=Nom,Acc|Number=Sing|Gender=Neut",
        "daṇḍakāraṇyaśūnyatvam": "Compound=daṇḍaka+araṇya+śūnyatva|Case=Nom,Acc|Number=Sing|Gender=Neut"
      },
      equivalents: {
        en: ["empty", "void", "emptiness"],
        bo: ["stong pa", "stong pa nyid"],
        zh: ["空", "空性"]
      },
      note: "The -tva forms denote emptiness or the state of being empty; do not automatically read every occurrence as the later technical noun śūnyatā."
    }
  ]
};
