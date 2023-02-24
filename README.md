# Rulex

Excel based rule engine. Engine is inspired by other rule engines that load rules from spreadsheets, but allows to execute any JS conditions and actions.

## Installation

Run `yarn add rulex` or `npm i rulex` to install the engine. Engine is build with TypeScript and distributed with types definitions.

```typescript
import RulexEngine from `rulex`;

// Setup engine and pass optional logger function
const engine = new RulexEngine(console.log);

// Init engine with rules Excel file
await engine.init("path/to/rules.xlsx");

// Process fact with the engine
// Note: returned fact will be a different object, so fact !== initialFact not just by type, but also values may be different if they were modified by actions
const {fact, context, result} = await engine.process(initialFact);
```

## Excel File

Rulex works with excel files that must be prepared based on certain rules.

- Worksheet names containing the rules should start with `step` keyword (case agnostic)
- Worksheet name containing the default context values should start with `context` keyword
- Header row should be the first one in the worksheet

## Step Worksheet Definition

Step worksheet should always have:
- `name` column, and each row containing the rule should have a value under this column (duplicate names are allowed)
- Action or break column definitions, if rule has no action or break rule, it is skipped.

### Step Worksheet Columns

All the column names are case agnostic, e.g. `action` and `Action` are both valid definitions.

- `name` - required column that defines rule name
- `condition` - optional column that evaluates the expression in each cell, empty cells cause condition to **pass**
- `if {property}` - optional column that compares the value in each cell with `{property}`, empty cells couse comparison to **pass**
- `action` - optional column that evaluates the expression in the cell if all conditions and `if` comparisons are true, blank cells will be ignored
- `set {property}` - optional column that sets the value in the cell to `{property}` if all conditions and `if` comparisons are true, blank cells will be ignored

### Context Worksheet Columns

All the column names are case agnostic, e.g. `value` and `Value` are both valid definitions.

- `name` - required column that defines the context variable name
- `value` - required column that defines the context variable value

Context values are set before processing steps and can be references with `context` object, e.g `context.something` or `context['something']`