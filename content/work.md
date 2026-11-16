---
# The Work page (preis.works/work/). Every word on the page lives in this file; the drawing and the
# layout live in src/pages/work.astro. The two paragraphs at the top of the page are the text below this header.

# Search engines show this under the page title
description: I'm a life science strategy consultant based in Copenhagen, working globally with pharma and biotech companies on the commercial choices that shape therapeutics, from early assets to launch.

# The commercial core: above the value chain on computers, under "At the commercial core" on phones
core:
  - title: Corporate, portfolio, and TA strategy
    text: Where to play, in which order, and with which assets, including what to stop. Choices global leadership teams make to translate into priorities for regions and affiliates.
  - title: Commercial assessments
    text: Clear answers on assets, indications, and markets ahead of a gate, board, or investment decision, from patient waterfalls and pricing to access and competition.
  - title: Launch readiness
    text: Assets and organisations ready for launch, especially first launches into a new therapeutic area, modality, or geography, where commercial, medical, access, and supply have to move together.
  - title: Go-to-market and customer strategy
    text: Which customers to win and how, grounded in what HCPs, patients, and payers say, and turned into initiatives the teams own.

# The boxes of the value chain, left to right (top to bottom on phones). key ties a box to its drawing;
# kind: solid, dashed (outside my focus), or core (the hatched box).
# note: the commercial interface, under the box on computers and under "At the commercial interfaces" on phones.
# phone: the headline and two lines beside the box on phones (dashed boxes have none).
stages:
  - key: rd
    label: R&D
    kind: solid
    note:
      title: Commercial lens on R&D
      text: Indication and lead asset choices, external innovation, and partnership strategy.
    phone:
      title: Commercial lens
      text: Which assets, indications, and partners to pursue
  - key: cmc
    label: CMC and supply chain
    kind: solid
    note:
      title: Manufacturing economics
      text: Cost models, investment cases, operating models, and organisational scale-up.
    phone:
      title: Manufacturing economics
      text: Business cases and operating models to scale up
  - key: reg
    label: Regulatory
    kind: dashed
  - key: med
    label: Medical
    kind: solid
    note:
      title: Medical readiness
      text: Evidence and partnership strategy, patient journeys, and medical engagement.
    phone:
      title: Medical readiness
      text: Evidence, patient journeys, and engagement
  - key: com
    label: Commercial
    kind: core
    phone:
      title: The core of my work
      text: Portfolio, assessments, launch, and go-to-market
  - key: mkt
    label: In-market execution
    kind: dashed

# Tags under the value chain. The first therapeutic area is set in bold
therapeuticAreas:
  - Cardio-kidney-metabolic, including obesity
  - Gastroenterology and microbiome
  - Reproductive medicine
  - Dermatology
  - Neuroscience
  - Rare diseases
modalities:
  - Peptides
  - Antibodies
  - Small molecules
  - Cell and gene therapy
  - Microbiome therapeutics
  - Diagnostics and biomarkers

# Selected work: the cards in the carousel. They appear in a random order on every visit, and the
# filter lists every tag used here, so a new tag needs nothing else
cards:
  - tag: Portfolio strategy
    title: A franchise at a crossroads
    situation: A specialty pharma company with a market-leading franchise under pressure from a changing treatment landscape and limited traction for its latest innovation.
    done: Strategic options tested for attractiveness and ability to win, from geographic focus to what to stop, continue, or grow. The new direction was chosen with leadership and adopted by the executive committee and board.
  - tag: Portfolio strategy
    title: Building a new therapeutic area across a region
    situation: A regional organisation preparing its markets to move into a therapeutic area new to the company, with readiness varying widely between affiliates.
    done: A readiness baseline across eight key markets, with archetypes and organisational implications, set out the region's role in building the new area and the roadmap to get there.
  - tag: Portfolio strategy
    title: A regional strategy back on track
    situation: A long-term strategy for a new therapeutic area, set globally but with limited and uneven activity across markets in its first years.
    done: An assessment of execution across the region's largest markets, covering targeting and resource allocation, gave regional leadership options to bring the first horizon back on track.
  - tag: Commercial assessment
    title: A fast view on a new indication
    situation: A global pharma company needing a quick view on the value of a new indication for an established product, with several regulatory paths still open.
    done: Commercial scenarios, validated with a cross-functional group and tested in a workshop, gave leadership a basis for the decision and a blueprint for assessing future indications.
  - tag: Commercial assessment
    title: Use cases for a platform spin-out
    situation: An early-stage platform company choosing which use cases should guide its technology development ahead of a funding round.
    done: Scenarios validated with pharma, investor, and scientific experts and decided in three workshops narrowed the field to two priority use cases, each with a roadmap to the next round.
  - tag: Commercial assessment
    title: A new use for an existing asset
    situation: A specialty pharma company weighing a new application for one of its assets alongside a fast-growing drug class, ahead of a board decision.
    done: A business case and scenario model covering market evolution, pricing, access, and patient segments, with a storyline taken to the executive committee and board.
  - tag: External innovation & partnerships
    title: An external pipeline for a global pharma
    situation: A global pharma company's research organisation looking to build a focused external pipeline and to decide how to engage with a leading life science hub.
    done: An ecosystem assessment built on 20+ interviews, and a pipeline strategy across research collaborations, venture investments, and M&A, focused on areas that strengthen and complement the existing portfolio.
  - tag: External innovation & partnerships
    title: Diagnostic partnerships ahead of a launch
    situation: A launch whose uptake relied on partners in diagnostics, with a test available in most markets but used inconsistently.
    done: Adoption barriers turned into partnership recommendations for four major markets, a catalogue of good practice, and a self-assessment tool for other markets.
  - tag: Launch readiness
    title: A first-in-class launch
    situation: A regional organisation preparing its business areas for a first-in-class therapy, with a new disease narrative to establish.
    done: A launch planning framework translated the global strategy into cross-functional activities, milestones, and owners for each business area, starting three years before launch.
  - tag: Launch readiness
    title: A biotech's first launch
    situation: A clinical-stage biotech preparing its first launch without an established commercial organisation.
    done: A launch readiness framework built around the company's therapeutic and organisational context set out the capabilities, decisions, and timing needed to reach launch, focusing limited resources on the highest-impact activities.
  - tag: Launch readiness
    title: A testing landscape ahead of a launch
    situation: A launch into a disease area where diagnosis was not yet routine, with testing set up very differently from market to market.
    done: A testing landscape across nine markets, covering infrastructure, reimbursement, and awareness, identified the most critical barriers in each market to prioritise efforts and ensure launch readiness.
  - tag: Go-to-market
    title: HCP activation in a self-pay market
    situation: An affiliate looking to activate primary care HCPs and set its product apart in a market where patients pay out of pocket.
    done: A survey of more than 100 HCPs tested hypotheses on prescribing barriers, and a cross-functional workshop turned the findings into activation initiatives.
  - tag: Go-to-market
    title: Preparing HCP engagement for a new launch
    situation: A regional organisation laying the foundation for a new launch by optimising engagement with the HCPs it already reaches through its existing portfolio.
    done: A prescriber overlap analysis identified the priority HCPs across the existing portfolio and the new asset, and an in-field pilot was outlined with a lead market.
  - tag: Go-to-market
    title: Patient journeys across care settings
    situation: Affiliates needing to understand where patients are lost on the way from diagnosis to treatment.
    done: Patient journeys built on interviews with HCPs in primary and specialist care identified where to intervene, and the opportunities for each affiliate.
  - tag: Operating model
    title: Scaling a cell therapy manufacturer
    situation: A contract manufacturer for cell therapies needing an operating model and cost structure it could scale on.
    done: An operating model covering service portfolio, project archetypes, resourcing, and budget forecasting, and the narrative for board discussions on long-term sustainability and growth ahead of key investment decisions.

experience:
  - { name: Biobridge Partners, years: Since 2022 }
  - { name: Novo Nordisk, years: 2020 to 2022 }
  - { name: Monitor Deloitte, years: 2019 to 2020 }

education:
  - { name: Copenhagen Business School, detail: "MSc in Adv. Economics and Finance, 2019" }
  - { name: "University of Michigan, Ross School of Business", detail: "MBA exchange, 2018" }
  - { name: University of Strathclyde, detail: "BA in Economics and Finance, 2017" }
---

I'm a life science strategy consultant based in Copenhagen, with a global perspective. I work with pharma and biotech companies on the commercial choices that shape therapeutics, from early assets to launch.

My work sits at the commercial core, from portfolio and therapeutic area choices to launch and go-to-market. It extends into the commercial interfaces with R&D, CMC, and medical, where choices on indications, manufacturing economics, and evidence generation set an asset's value long before launch. Across both, I help leadership teams make the commercial case a driver of decisions along the value chain.
