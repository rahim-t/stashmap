import { Map } from "immutable";
import { parseDocumentContent } from "./markdownNodes";
import { renderDocumentMarkdown } from "./documentRenderer";

const ALICE = {
  publicKey:
    "0000000000000000000000000000000000000000000000000000000000000001" as PublicKey,
};

const TEST_MARKDOWN = `# Root <!-- id:root nodeKind="topic" -->
- Author <!-- id:author nodeKind="author" -->
  - Work <!-- id:work nodeKind="source" -->
    - (!) Thesis <!-- id:thesis nodeKind="statement" -->
`;

function getRequiredNode(
  nodes: Map<string, GraphNode>,
  text: string
): GraphNode {
  const node = nodes.find((candidate) => candidate.text === text);
  if (!node) {
    throw new Error(`Missing node ${text}`);
  }
  return node;
}

function buildKnowledgeDBs(
  nodes: Map<string, GraphNode>
): Map<PublicKey, KnowledgeData> {
  return Map<PublicKey, KnowledgeData>({
    [ALICE.publicKey]: { nodes },
  });
}

test("nodeKind imports and exports through markdown comments", () => {
  const nodes = parseDocumentContent({
    content: TEST_MARKDOWN,
    author: ALICE.publicKey,
  });
  const root = getRequiredNode(nodes, "Root");
  const author = getRequiredNode(nodes, "Author");
  const work = getRequiredNode(nodes, "Work");
  const thesis = getRequiredNode(nodes, "Thesis");
  // eslint-disable-next-line testing-library/render-result-naming-convention
  const exported = renderDocumentMarkdown(buildKnowledgeDBs(nodes), root);

  expect(root.nodeKind).toBe("topic");
  expect(author.nodeKind).toBe("author");
  expect(work.nodeKind).toBe("source");
  expect(thesis.nodeKind).toBe("statement");
  expect(exported).toContain('nodeKind="topic"');
  expect(exported).toContain('nodeKind="author"');
  expect(exported).toContain('nodeKind="source"');
  expect(exported).toContain('nodeKind="statement"');
});
