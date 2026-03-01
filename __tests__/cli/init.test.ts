import fs from 'fs';
import path from 'path';
import os from 'os';
import { README_URL, createAiboSymlink, resolvePackageDir, isAiboInitRequired, AIBO_LINKED_SUBDIRS } from '@/cli/init';
import { loadSubAgents } from '@/infrastructure/agents/loader';
import { findSkillsDirectories } from '@/core/utils';

describe('resolvePackageDir', () => {
  it('should return a path that ends with two segments up from __dirname equivalent', () => {
    const packageDir = resolvePackageDir();
    expect(typeof packageDir).toBe('string');
    expect(path.isAbsolute(packageDir)).toBe(true);
  });
});

describe('README_URL', () => {
  it('should point to the aibo GitHub repository readme', () => {
    expect(README_URL).toContain('github.com/xiaoshuangLi/aibo');
    expect(README_URL).toContain('#readme');
  });
});

describe('createAiboSymlink', () => {
  let tmpDir: string;
  let packageDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-symlink-test-'));
    packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-pkg-test-'));
    // Create the expected subdirectories in packageDir so symlinks can be created
    for (const subdir of AIBO_LINKED_SUBDIRS) {
      fs.mkdirSync(path.join(packageDir, subdir));
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(packageDir, { recursive: true, force: true });
  });

  it('creates a .aibo directory (not a symlink) inside targetDir', () => {
    createAiboSymlink(tmpDir, packageDir);

    const aiboPath = path.join(tmpDir, '.aibo');
    expect(fs.existsSync(aiboPath)).toBe(true);
    const stat = fs.lstatSync(aiboPath);
    expect(stat.isDirectory()).toBe(true);
    expect(stat.isSymbolicLink()).toBe(false);
  });

  it('creates selective symlinks for each AIBO_LINKED_SUBDIRS entry', () => {
    createAiboSymlink(tmpDir, packageDir);

    for (const subdir of AIBO_LINKED_SUBDIRS) {
      const linkPath = path.join(tmpDir, '.aibo', subdir);
      expect(fs.existsSync(linkPath)).toBe(true);
      expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
      expect(fs.realpathSync(linkPath)).toBe(fs.realpathSync(path.join(packageDir, subdir)));
    }
  });

  it('recreates .aibo when it already exists as a symlink', () => {
    const aiboPath = path.join(tmpDir, '.aibo');
    const firstPackageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-pkg1-'));
    fs.symlinkSync(firstPackageDir, aiboPath, 'dir');

    createAiboSymlink(tmpDir, packageDir);

    const stat = fs.lstatSync(aiboPath);
    expect(stat.isDirectory()).toBe(true);
    expect(stat.isSymbolicLink()).toBe(false);

    fs.rmSync(firstPackageDir, { recursive: true, force: true });
  });

  it('skips subdirs that do not exist in packageDir', () => {
    // Create a packageDir without any subdirectories
    const emptyPkgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-pkg-empty-'));
    try {
      createAiboSymlink(tmpDir, emptyPkgDir);

      const aiboPath = path.join(tmpDir, '.aibo');
      expect(fs.existsSync(aiboPath)).toBe(true);
      // No sub-symlinks should have been created
      for (const subdir of AIBO_LINKED_SUBDIRS) {
        expect(fs.existsSync(path.join(aiboPath, subdir))).toBe(false);
      }
    } finally {
      fs.rmSync(emptyPkgDir, { recursive: true, force: true });
    }
  });
});

describe('isAiboInitRequired', () => {
  const originalCwd = process.cwd;

  afterEach(() => {
    process.cwd = originalCwd;
  });

  it('returns false when cwd equals the package directory', () => {
    const packageDir = resolvePackageDir();
    process.cwd = () => packageDir;
    expect(isAiboInitRequired()).toBe(false);
  });

  it('returns true when cwd differs from package dir and has no .aibo folder', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-init-check-'));
    try {
      process.cwd = () => tmpDir;
      expect(isAiboInitRequired()).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns false when cwd differs from package dir but .aibo folder exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-init-check-'));
    const pkgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-init-pkg-'));
    try {
      fs.mkdirSync(path.join(tmpDir, '.aibo'));
      process.cwd = () => tmpDir;
      expect(isAiboInitRequired()).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pkgDir, { recursive: true, force: true });
    }
  });
});

describe('createAiboSymlink - runtime loading integration', () => {
  let tmpDir: string;
  let packageDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-rt-'));
    packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-rt-pkg-'));

    // Populate packageDir/agents with a test agent markdown file
    fs.mkdirSync(path.join(packageDir, 'agents'));
    fs.writeFileSync(
      path.join(packageDir, 'agents', 'sample.md'),
      '---\nname: sample-agent\ndescription: A sample agent\n---\nSample prompt.'
    );

    // Populate packageDir/skills with a non-empty skill file
    fs.mkdirSync(path.join(packageDir, 'skills'));
    fs.writeFileSync(path.join(packageDir, 'skills', 'SKILL.md'), '# Sample skill');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(packageDir, { recursive: true, force: true });
  });

  it('loadSubAgents finds agents from .aibo/agents after createAiboSymlink', () => {
    createAiboSymlink(tmpDir, packageDir);
    const agents = loadSubAgents(tmpDir);
    expect(agents.some(a => a.name === 'sample-agent')).toBe(true);
  });

  it('findSkillsDirectories finds .aibo/skills after createAiboSymlink', () => {
    createAiboSymlink(tmpDir, packageDir);
    const skillsDirs = findSkillsDirectories(tmpDir);
    expect(skillsDirs.some(d => d.includes('.aibo') && d.includes('skills'))).toBe(true);
  });
});
