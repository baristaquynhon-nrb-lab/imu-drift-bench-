# ASE RITUAL EXECUTION PROTOCOL — TET PREPARATION

**Protocol ID:** `RITUAL_TET_PREPARATION_VN_v1.0`
**Execution Model:** Agent-Schema-Event
**Domain:** Pragmatic-Ritual
**Nature:** Cyclical · Calendar-triggered · Multi-agent
**Source Text:** Traditional rituals before Tet (EN)
**Status:** NORMATIVE

---

## Source Text (EN)

> Traditional rituals before Tet
>
> These customs and traditions associated with the Vietnamese Lunar New Year
> have been passed down from generation to generation, preserving their
> significance year after year. Here are some of the customary practices to
> prepare for the Tet holiday:
>
> 1. The custom of making offerings to the Kitchen God on the 23rd day of the twelfth lunar month
> 2. The tradition of making "banh chung" and "banh tet" (traditional Tet cakes)
> 3. The tradition of arranging the "5 fruits" tray placed on the family altar
> 4. The tradition of visiting ancestors' graves
> 5. The tradition of "cung tat nien" (year-end ceremony) to ancestors and the earth
> 6. The tradition of celebrating New Year's Eve

---

## I. AGENT DECLARATIONS

```
AGENT_DEFINE  FAMILY          TYPE=COLLECTIVE_HUMAN
AGENT_DEFINE  ANCESTORS       TYPE=SPIRITUAL_LINEAGE
AGENT_DEFINE  KITCHEN_GOD     TYPE=HOUSEHOLD_GUARDIAN_SPIRIT
AGENT_DEFINE  EARTH_SPIRIT    TYPE=COSMOLOGICAL_ENTITY
AGENT_DEFINE  GRAVE_SITE      TYPE=MEMORIAL_LOCATION
AGENT_DEFINE  FAMILY_ALTAR    TYPE=RITUAL_OBJECT
AGENT_DEFINE  CALENDAR        TYPE=LUNAR_SYSTEM
```

---

## II. SCHEMA REGISTRATION

```
SCHEMA_REGISTER  SCH_KITCHEN_GOD_OFFERING
SCHEMA_REGISTER  SCH_TET_FOOD_PRODUCTION
SCHEMA_REGISTER  SCH_FIVE_FRUIT_ALTAR
SCHEMA_REGISTER  SCH_ANCESTOR_GRAVE_VISIT
SCHEMA_REGISTER  SCH_TAT_NIEN_YEAR_CLOSURE
SCHEMA_REGISTER  SCH_NEW_YEAR_THRESHOLD
```

---

## III. TEMPORAL TRIGGERS

```
TIME_BIND  SCH_KITCHEN_GOD_OFFERING     CALENDAR.LUNAR_MONTH=12 DAY=23
TIME_BIND  SCH_TET_FOOD_PRODUCTION      PERIOD=PRE_TET
TIME_BIND  SCH_FIVE_FRUIT_ALTAR         PERIOD=PRE_TET
TIME_BIND  SCH_ANCESTOR_GRAVE_VISIT     PERIOD=PRE_TET
TIME_BIND  SCH_TAT_NIEN_YEAR_CLOSURE    EVENT=END_OF_LUNAR_YEAR
TIME_BIND  SCH_NEW_YEAR_THRESHOLD       EVENT=MIDNIGHT_LUNAR_NEW_YEAR
```

---

## IV. EVENT EXECUTION STREAM

### 1. Kitchen God Ritual

```
PRAG_EVENT  EXECUTE_SCHEMA  SCH_KITCHEN_GOD_OFFERING
PRAG_EVENT  OFFER           FAMILY → KITCHEN_GOD    OBJECT=RITUAL_FOOD
PRAG_EVENT  SEND_REPORT     KITCHEN_GOD → HEAVENS   PURPOSE=ANNUAL_STATUS
```

### 2. Tet Cake Production

```
PRAG_EVENT  EXECUTE_SCHEMA  SCH_TET_FOOD_PRODUCTION
PRAG_EVENT  PRODUCE         FAMILY  OBJECT=BANH_CHUNG  SYMBOL=EARTH
PRAG_EVENT  PRODUCE         FAMILY  OBJECT=BANH_TET    SYMBOL=HEAVEN
PRAG_EVENT  SHARE           FOOD    FAMILY             ROLE=COMMUNAL_BONDING
```

### 3. Five-Fruit Offering

```
PRAG_EVENT  EXECUTE_SCHEMA    SCH_FIVE_FRUIT_ALTAR
PRAG_EVENT  ARRANGE_OFFERING  FAMILY → FAMILY_ALTAR   OBJECT=FIVE_FRUITS
PRAG_EVENT  SYMBOLIC_INVOKE   FAMILY → ANCESTORS      MEANING=PROSPERITY
```

### 4. Ancestor Grave Visit

```
PRAG_EVENT  EXECUTE_SCHEMA  SCH_ANCESTOR_GRAVE_VISIT
PRAG_EVENT  VISIT           FAMILY → GRAVE_SITE
PRAG_EVENT  CLEAN           FAMILY  TARGET=GRAVE_SITE
PRAG_EVENT  OFFER           FAMILY → ANCESTORS         OBJECT=INCENSE
PRAG_EVENT  HONOR           FAMILY → ANCESTORS         TYPE=LINEAGE_RESPECT
```

### 5. Year-End Ceremony (Cung Tat Nien)

```
PRAG_EVENT  EXECUTE_SCHEMA  SCH_TAT_NIEN_YEAR_CLOSURE
PRAG_EVENT  OFFER           FAMILY → ANCESTORS         OBJECT=YEAR_END_FOOD
PRAG_EVENT  OFFER           FAMILY → EARTH_SPIRIT      OBJECT=RITUAL_SYMBOLS
PRAG_EVENT  CLOSE_YEAR      FAMILY                     STATE=PAST_YEAR_COMPLETED
```

### 6. New Year Threshold Ritual

```
PRAG_EVENT  EXECUTE_SCHEMA    SCH_NEW_YEAR_THRESHOLD
PRAG_EVENT  CELEBRATE         FAMILY       TYPE=THRESHOLD_RITUAL
PRAG_EVENT  TRANSITION_STATE  YEAR         OLD_YEAR → NEW_YEAR
PRAG_EVENT  INVOKE            FAMILY → COSMIC_ORDER   MEANING=RENEWAL
```

---

## V. RESULTING SOCIAL STATE TRANSFORMATION

```
STATE_UPDATE  SOCIAL_CONTINUITY=MAINTAINED
STATE_UPDATE  LINEAGE_CONNECTION=REINFORCED
STATE_UPDATE  SPIRITUAL_BALANCE=RESTORED
STATE_UPDATE  TEMPORAL_RESET=COMPLETED
```

---

## VI. PROTOCOL SEMANTIC CLASS

```
CLASSIFICATION:    CYCLICAL_RITUAL_EXECUTION_PROGRAM
DETERMINISM:       TRIGGER_BOUND
AGENT_DOMAIN:      HUMAN + SPIRITUAL + COSMIC
EXECUTION_MODE:    NON-LINGUISTIC SOCIAL ACTION
```

---

## VII. Architectural Significance

This is not "culture described in words" but an:

> **Executable Cultural Program**

-- equivalent to a social operating system routine activated annually.

The entire Tet preparation sequence is a deterministic, calendar-triggered
ritual program with:

- **7 agents** across 3 ontological classes (human, spiritual, cosmic)
- **6 schemas** mapping to 6 distinct ritual phases
- **6 temporal triggers** bound to lunar calendar events
- **19 pragmatic events** forming the execution stream
- **4 state updates** as social state transformation outputs
