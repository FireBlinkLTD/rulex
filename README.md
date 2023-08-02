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
// ... or
// Init engine with rules Excel file and run tests if any defined
await engine.init("path/to/rules.xlsx", true);

// Process fact
// Note: returned fact will be a different object, so fact !== initialFact not just by type, but also values may be different if they were modified by actions
const {fact, context, result} = await engine.process(initialFact);

// ... or
// Process fact with extra default context variables 
const {fact, context, result} = await engine.process(initialFact, {
  extraContextVariable: true
});

// ... or
// Process fact and get detailed explanation (for debug purposes)
// Make sure not to use the debug property in production as it adds a performance hit
try {
  const {fact, context, result, explanation} = await engine.process(initialFact, {}, true);
} catch (ruleError) {
  // custom handler for the RuleError
}
```

## Excel File

Example `rules.xlsx` file can be found under `test/assets/rules` folder.

Rulex works with excel files that must be prepared based on certain rules.

- Worksheet names containing the rules should start with `step` keyword (case agnostic)
- Worksheet name containing the default context values should start with `context` keyword (case agnostic)
- Worksheet name containing tests should start with `test` keyword (case agnostic)
- Header row should be the first one in the worksheet

## Step Worksheet Definition

Step worksheet should always have:
- `name` column, and each row containing the rule should have a value under this column (duplicate names are allowed)
- Action or break column definitions, if rule has no action or break rule, it is skipped.

### Step Worksheet Columns

All the column names are case agnostic, e.g. `action` and `Action` are both valid definitions.

- `name` - required column that defines rule name
- `condition` - optional column that evaluates the expression in each cell, empty cells cause condition to **pass**
- `if {property}` - optional column that compares the value in each cell with `{property}`, empty cells cause comparison to **pass**
- `if not {property}` - optional column that compares the value in each cell with `{property}`, condition passes when values do not match, empty cells cause comparison to **pass**
- `in {property}` - optional column that compares the `{property}` with any value in the comma-separated list of the cell value, match cause condition to **pass**
- `out {property}` - optional column that compares the `{property}` with any value in the comma-separated list of the cell value, mismatch cause condition to **pass**
- `type {property}` - optional column that compares the value in each cell with `{property}` type, empty cells cause comparison to **pass**, allowed values: `string`, `number`
- `type not {property}` - optional column that compares the value in each cell with `{property}` type, condition passes when values do not match, empty cells cause comparison to **pass**
- `action` - optional column that evaluates the expression in the cell if all conditions and `if` comparisons are true, blank cells will be ignored
- `set {property}` - optional column that sets the value in the cell to `{property}` if all conditions and `if` comparisons are true, blank cells will be ignored
- `break` - optional column that will cause engine to stop immediately if condition passes and value of the break cell is true, can be used to terminate the execution
- `error[ code]` - similar to `break` column, but will cause engine to throw an `RuleError` with a message as the value in the cell, `code` is optional in the name. Examples: `error`, `error 404`

### Context Worksheet Columns

All the column names are case agnostic, e.g. `value` and `Value` are both valid definitions.

- `name` - required column that defines the context variable name
- `value` - required column that defines the context variable value

Context values are set before processing steps and can be references with `context` object, e.g `context.something` or `context['something']`

### Test Worksheet Columns

All the column names are case agnostic, e.g. `name` and `Name` are both valid definitions.

- `name` - required column that defines the test name, duplicated names across rows are allowed
- `set {property}` - optional column that sets the value in the cell to `{property}`, e.g. `fact.something`
- `expect {property}` - optional column that expects value in the cell to match `{property}` after execution, e.g. `result.something` 

### RuleError

RuleError is thrown when `break` column rule triggers.

Error exposes following properties:
- `message` - the value of the cell
- `code` - optional code provided in the column header, if not provided value will be a blank string
- `step` - name of the step (worksheet) where error was triggered
- `rule` - matches the `name` column value for the row where error was triggered
- `explanation` - optional explanation object, only available when `process` is invoked with explanation flag 
- `context` - context state when error ocurred
- `fact` - state of the fact when error ocurred

## CLI

In order to help with testing the engine file rules ships with a simple CLI that will load file and run all the tests.

```bash
# installation
npm i -g rulex

# usage
rulex path/to/rules.xlsx
```