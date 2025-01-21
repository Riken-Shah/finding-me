interface Env {
  AI: Ai;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const input = { prompt: "What is the origin of the phrase Hello, World" };

  const answer = await context.env.AI.run(
    "@cf/meta/llama-3.1-8b-instruct",
    input,
  );

  return Response.json(answer);
};