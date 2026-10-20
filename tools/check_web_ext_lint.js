let output = "";

for await (const chunk of process.stdin) {
  output += chunk;
}

let result;
try {
  result = JSON.parse(output);
} catch {
  console.error("web-ext lint did not produce valid JSON output.");
  process.exitCode = 1;
}

if (
  result === null ||
  typeof result !== "object" ||
  Array.isArray(result) ||
  !Array.isArray(result.errors)
) {
  console.error("web-ext lint JSON output has no errors list.");
  process.exitCode = 1;
} else {
  const errors = result.errors.filter((error) => {
    const isThunderbirdExperimentApi =
      error.code === "MANIFEST_FIELD_PRIVILEGED" &&
      error.file === "manifest.json" &&
      error.instancePath === "/experiment_apis";

    if (isThunderbirdExperimentApi) {
      console.log(
        "Ignoring web-ext's Firefox-only privileged-field error for Thunderbird experiment_apis.",
      );
    }

    return !isThunderbirdExperimentApi;
  });

  if (errors.length > 0) {
    console.error(JSON.stringify({ ...result, errors }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify(
        {
          ...result,
          count: result.count - result.errors.length,
          errors,
          summary: { ...result.summary, errors: 0 },
        },
        null,
        2,
      ),
    );
  }
}
