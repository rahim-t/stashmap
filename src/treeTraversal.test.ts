import { List, Map } from "immutable";
import { getNode } from "./connections";
import { parseDocumentContent } from "./markdownNodes";
import { getNodesInTree } from "./treeTraversal";
import { ViewPath, viewPathToString } from "./ViewContext";
import { ALICE, applyDefaults } from "./utils.test";

const TEST_MARKDOWN = `# Root <!-- id:root nodeKind="topic" -->
- Later Topic <!-- id:later-topic nodeKind="topic" -->
  - Zelda Author <!-- id:zelda-author nodeKind="author" -->
    - Zanzibar Work <!-- id:zanzibar-work nodeKind="source" -->
      - (!) Later Thesis <!-- id:later-thesis nodeKind="statement" -->
  - Empty Author <!-- id:empty-author nodeKind="author" -->
    - Empty Work <!-- id:empty-work nodeKind="source" -->
  - Alpha Author <!-- id:alpha-author nodeKind="author" -->
    - Beta Work <!-- id:beta-work nodeKind="source" -->
      - First Thesis <!-- id:first-thesis nodeKind="statement" -->
      - Second Thesis <!-- id:second-thesis nodeKind="statement" -->
- Earlier Topic <!-- id:earlier-topic nodeKind="topic" -->
  - Alpha Author <!-- id:alpha-author-2 nodeKind="author" -->
    - Alpha Work <!-- id:alpha-work nodeKind="source" -->
      - Earlier Thesis <!-- id:earlier-thesis nodeKind="statement" -->
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

function collectExpandedViews(
  knowledgeDBs: KnowledgeDBs,
  node: GraphNode,
  path: ViewPath,
  views: Views = Map<string, View>()
): Views {
  const withCurrent =
    node.children.size > 0
      ? views.set(viewPathToString(path), { expanded: true })
      : views;
  return node.children.reduce((acc, childID) => {
    const child = getNode(knowledgeDBs, childID, ALICE.publicKey);
    return child
      ? collectExpandedViews(
          knowledgeDBs,
          child,
          [...path, child.id] as ViewPath,
          acc
        )
      : acc;
  }, withCurrent);
}

function buildData(nodeKindFilters: NodeKind[] | undefined): {
  data: Data;
  rootPath: ViewPath;
} {
  const nodes = parseDocumentContent({
    content: TEST_MARKDOWN,
    author: ALICE.publicKey,
  });
  const root = getRequiredNode(nodes, "Root");
  const rootPath = [0, root.id] as ViewPath;
  const knowledgeDBs = buildKnowledgeDBs(nodes);
  const views = collectExpandedViews(knowledgeDBs, root, rootPath);
  return {
    rootPath,
    data: applyDefaults({
      knowledgeDBs,
      views,
      panes: [
        {
          id: "pane-0",
          stack: [],
          author: ALICE.publicKey,
          nodeKindFilters,
        },
      ],
    }),
  };
}

function visibleRows(filters: NodeKind[]): { text: string; depth: number }[] {
  const { data, rootPath } = buildData(filters);
  const result = getNodesInTree(
    data,
    rootPath,
    [],
    List<ViewPath>(),
    undefined,
    ALICE.publicKey,
    undefined,
    filters
  );
  return result.paths
    .map((path) => {
      const key = viewPathToString(path);
      const node = getNode(
        data.knowledgeDBs,
        path[path.length - 1] as ID,
        ALICE.publicKey
      );
      return {
        text: node?.text || "",
        depth: result.displayDepths.get(key) ?? path.length - 1,
      };
    })
    .toArray();
}

test("node kind topic filter shows topics only", () => {
  expect(visibleRows(["topic"])).toEqual([
    { text: "Later Topic", depth: 2 },
    { text: "Earlier Topic", depth: 2 },
  ]);
});

test("node kind author filter is an alphabetical index when topics are hidden", () => {
  expect(visibleRows(["author"])).toEqual([
    { text: "Alpha Author", depth: 2 },
    { text: "Alpha Author", depth: 2 },
    { text: "Empty Author", depth: 2 },
    { text: "Zelda Author", depth: 2 },
  ]);
});

test("combined topic and author filters keep topic context", () => {
  expect(visibleRows(["topic", "author"])).toEqual([
    { text: "Later Topic", depth: 2 },
    { text: "Zelda Author", depth: 3 },
    { text: "Empty Author", depth: 3 },
    { text: "Alpha Author", depth: 3 },
    { text: "Earlier Topic", depth: 2 },
    { text: "Alpha Author", depth: 3 },
  ]);
});

test("combined topic and source filters keep contains order", () => {
  expect(visibleRows(["topic", "source"])).toEqual([
    { text: "Later Topic", depth: 2 },
    { text: "Zanzibar Work", depth: 3 },
    { text: "Empty Work", depth: 3 },
    { text: "Beta Work", depth: 3 },
    { text: "Earlier Topic", depth: 2 },
    { text: "Alpha Work", depth: 3 },
  ]);
});

test("node kind source filter sorts as a source index when topics are hidden", () => {
  expect(visibleRows(["source"])).toEqual([
    { text: "Alpha Work", depth: 2 },
    { text: "Beta Work", depth: 2 },
    { text: "Empty Work", depth: 2 },
    { text: "Zanzibar Work", depth: 2 },
  ]);
});

test("node kind statement filter groups by source when topics are hidden", () => {
  expect(visibleRows(["statement"])).toEqual([
    { text: "Earlier Thesis", depth: 2 },
    { text: "First Thesis", depth: 2 },
    { text: "Second Thesis", depth: 2 },
    { text: "Later Thesis", depth: 2 },
  ]);
});
