// Code metrics calculations
import type { FileCommit, FileInfo } from "./git.js";
import { isBugFix, getUniqueAuthors, getRecencyWeight } from "./git.js";

export interface MetricResult {
  file: string;
  value: number;
  details?: Record<string, any>;
}

export type MetricType =
  | "churn"
  | "recency-weighted-churn"
  | "bug-density"
  | "author-diversity"
  | "stability";

/**
 * Calculate L×C (Length × Changes) churn metric
 */
export function calculateChurn(
  file: string,
  commits: FileCommit[],
  fileInfo: FileInfo
): MetricResult {
  if (!fileInfo.exists || fileInfo.lines === 0) {
    return { file, value: 0, details: { lines: 0, changes: 0 } };
  }

  const value = fileInfo.lines * commits.length;

  return {
    file,
    value,
    details: {
      lines: fileInfo.lines,
      changes: commits.length,
    },
  };
}

/**
 * Calculate recency-weighted churn
 * Recent changes count more than old changes
 */
export function calculateRecencyWeightedChurn(
  file: string,
  commits: FileCommit[],
  fileInfo: FileInfo
): MetricResult {
  if (!fileInfo.exists || fileInfo.lines === 0) {
    return { file, value: 0, details: { lines: 0, weightedChanges: 0 } };
  }

  const now = new Date();
  const weightedChanges = commits.reduce((sum, commit) => {
    return sum + getRecencyWeight(commit.date, now);
  }, 0);

  const value = fileInfo.lines * weightedChanges;

  return {
    file,
    value,
    details: {
      lines: fileInfo.lines,
      changes: commits.length,
      weightedChanges: Math.round(weightedChanges * 100) / 100,
    },
  };
}

/**
 * Calculate bug density (proportion of bug-fix commits)
 */
export function calculateBugDensity(
  file: string,
  commits: FileCommit[],
  fileInfo: FileInfo
): MetricResult {
  if (commits.length === 0) {
    return { file, value: 0, details: { bugFixes: 0, totalChanges: 0, percentage: 0 } };
  }

  const bugFixes = commits.filter((c) => isBugFix(c.message)).length;
  const percentage = (bugFixes / commits.length) * 100;

  return {
    file,
    value: percentage,
    details: {
      bugFixes,
      totalChanges: commits.length,
      percentage: Math.round(percentage * 10) / 10,
    },
  };
}

/**
 * Calculate author diversity (number of unique authors)
 * Higher = more people work on it (good for knowledge sharing, but also potential coordination overhead)
 */
export function calculateAuthorDiversity(
  file: string,
  commits: FileCommit[],
  fileInfo: FileInfo
): MetricResult {
  const authors = getUniqueAuthors(commits);

  return {
    file,
    value: authors.size,
    details: {
      uniqueAuthors: authors.size,
      totalChanges: commits.length,
      authors: Array.from(authors).slice(0, 5), // Show first 5 authors
    },
  };
}

/**
 * Calculate stability score (days since last change)
 * Higher = more stable (hasn't changed recently)
 */
export function calculateStability(
  file: string,
  commits: FileCommit[],
  fileInfo: FileInfo
): MetricResult {
  if (commits.length === 0) {
    return { file, value: Infinity, details: { daysSinceLastChange: Infinity } };
  }

  // Commits are in reverse chronological order, so first is most recent
  const mostRecentCommit = commits[0];
  const now = new Date();
  const daysSinceLastChange = Math.floor(
    (now.getTime() - mostRecentCommit.date.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    file,
    value: daysSinceLastChange,
    details: {
      daysSinceLastChange,
      lastChange: mostRecentCommit.date.toISOString().split("T")[0],
      lastAuthor: mostRecentCommit.author,
    },
  };
}

/**
 * Calculate a metric for all files
 */
export function calculateMetric(
  metricType: MetricType,
  fileCommits: Map<string, FileCommit[]>,
  fileInfoMap: Map<string, FileInfo>
): MetricResult[] {
  const results: MetricResult[] = [];

  for (const [file, commits] of fileCommits) {
    const fileInfo = fileInfoMap.get(file);
    if (!fileInfo) continue;

    let result: MetricResult;

    switch (metricType) {
      case "churn":
        result = calculateChurn(file, commits, fileInfo);
        break;
      case "recency-weighted-churn":
        result = calculateRecencyWeightedChurn(file, commits, fileInfo);
        break;
      case "bug-density":
        result = calculateBugDensity(file, commits, fileInfo);
        break;
      case "author-diversity":
        result = calculateAuthorDiversity(file, commits, fileInfo);
        break;
      case "stability":
        result = calculateStability(file, commits, fileInfo);
        break;
    }

    results.push(result);
  }

  return results;
}
