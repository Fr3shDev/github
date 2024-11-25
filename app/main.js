const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto"); 
const https = require("https");
const { URL } = require('url')

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.error("Logs from your program will appear here!");

const command = process.argv[2];

switch (command) {
    case "init":
    createGitDirectory();
    break;
    case 'cat-file':
    const hash = process.argv[4];
    catFile(hash);
    break;
    case 'hash-object':
    const writeFlag = process.argv[3] === "-w";
    const filePath = process.argv[4];
    hashObject(filePath, writeFlag);
    break;
    case 'ls-tree':
        const treeHash = process.argv[3];
        lsTree(treeHash);
        break;
    case 'write-tree':
        writeTree()
        break;
    case 'commit':
        const treeSHA = process.argv[3];
        const parentSHA = process.argv[5] === '-p' ? process.argv[6] : null;
        const message = process.argv[process.argv.indexOf("-m") + 1];
        commitTree(treeSHA, parentSHA, message)
    case 'clone':
        const repoURL = process.argv[3];
        const targetDir = process.argv[4];
        cloneRepo(repoURL, targetDir);
        break
  default:
    throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
  fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });

  fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
  console.log("Initialized git directory");
}

 function catFile(hash) {
  const content = fs.readFileSync(path.join(process.cwd(), ".git", "objects", hash.slice(0, 2), hash.slice(2),),);
  const unzipped = zlib.inflateSync(content);
  const res = unzipped.toString().split('\0')[1];
  process.stdout.write(res);
}

function hashObject(filePath, writeFlag) {
  // Step 1: Read the file content
  const fileContent = fs.readFileSync(filePath);

  // Step 2: Prepare the "blob" header
  const header = `blob ${fileContent.length}\0`;
  const fullContent = Buffer.concat([Buffer.from(header), fileContent]);

  // Step 3: Compute the SHA-1 hash
  const hash = crypto.createHash("sha1").update(fullContent).digest("hex");

  // Step 4: Optionally write to the .git/objects directory
  if(writeFlag) {
    const compressedContent = zlib.deflateSync(fullContent);
    const dir = path.join(process.cwd(), ".git", "objects", hash.slice(0,2));
    const file = path.join(dir, hash.slice(2));

    // Create the directory if it doesn't exist
    fs.mkdirSync(dir, { recursive: true });

    // Write the compressed content to the file
    fs.writeFileSync(file, compressedContent);
  }

  // Step 5: Output the hash
  console.log(hash);
}

function lsTree(treeHash) {
    const treeFilePath = path.join(process.cwd(), ".git", "objects", treeHash.slice(0,2), treeHash.slice(2));
    const content = fs.readFileSync(treeFilePath);

    // Decompress the content of the tree object
    const unzipped = zlib.inflateSync(content);
    const data = unzipped.toString();

    // Split the data into the header and the entries
    const [header, ...entries] = data.split('\0');

    // Extract the size from the header (tree <size>\0)
    const headerParts = header.split(' ');
    if (headerParts[0] !== 'tree') {
        throw new Error(`Invalid tree object header: ${header}`)
    }

    // Parse the entries into an array of file/directory names
    const fileNames = entries.map(entry => {
        const entryParts = entry.split(' ');
        const mode = entryParts[0];
        const name = entryParts[1];
        const sha = entryParts[2];
        return { mode, name, sha }
    });

    // Sort entries alphabetically by name
    const sortedEntries = fileNames.sort((a, b) => a.name.localeCompare(b.name));

    // Print the file/directory names as per --name-only flag
    sortedEntries.forEach(entry => {
        console.log(entry.name);
    });
}

function writeTree(dir = process.cwd()) {
    const entries = [];

    const items = fs.readdirSync(dir, { withFileTypes: true });
    items.forEach((item) => {
        if (item.name === ".git") return;

        const itemPath = path.join(dir, item.name);
        let sha;
        let mode;

        if (item.isFile()) {
            const content = fs.readFileSync(itemPath);
            sha = writeObject("blob", content);
            mode = "100644"; // Regular file
        } else if (item.isDirectory()) {
            sha = writeTree(itemPath);
            mode = "040000"; // Directory
        }

        entries.push(`${mode} ${item.name}\0${Buffer.from(sha, "hex")}`);
    });

    entries.sort((a, b) => {
        const nameA = a.split("\0")[0].split(" ")[1];
        const nameB = b.split("\0")[0].split(" ")[1];
    });

    const treeContent = Buffer.concat([
        Buffer.from(`tree ${entries.length}\0`), ...entries.map((entry) => Buffer.from(entry)),
    ]);

    return writeObject("tree", treeContent);
}

function writeObject(type, content) {
    const header = `${type} ${content.length}\0`;
    const store = Buffer.concat([Buffer.from(header), content]);

    const sha = crypto.createHash("sha1").update(store).digest("hex");
    const objectPath = path.join(process.cwd(), ".git", "objects", sha.slice(0,2), sha.slice(2));

    if (!fs.existsSync(path.dirname(objectPath))) {
        fs.mkdirSync(path.dirname(objectPath), { recursive: true });
    }

    if (!fs.existsSync(objectPath)) {
        const compressed = zlib.deflateSync(store);
        fs.writeFileSync(objectPath, compressed);
    }

    console.log(sha);
    return sha;
}

function commitTree(treeSHA, parentSHA, message) {
    const authorName = "John Doe" // Hardcoded author
    const authorEmail = "john.doe@example.com"; // Hardcoded email
    const committerName = "John Doe"; // Hardcoded committer
    const committerEmail = "john.doe@example.com"; // Hardcoded email
    const timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp

    // Construct the commit header
    const header = `tree ${treeSHA}\n` + 
    (parentSHA ? `parent ${parentSHA}\n` : "") +
    `author ${authorName} <${authorEmail}> ${timestamp} +0000\n` +
    `committer ${committerName} <${committerEmail}> ${timestamp} +00000\n`;

    // Creat the commit content (header + message)
    const commitContent = Buffer.from(header + "\n" + message);

    // Write the commit object
    const commitSHA = writeObject("commit", commitContent);

    console.log(commitSHA);
}

function cloneRepo(url, dir) {
    const repoName = url.split('/').pop();
    const cloneDir = path.join(process.cwd(), dir);

    // Create the .git directory structure
    fs.mkdirSync(path.join(cloneDir, '.git', 'objects'), { recursive: true });
    fs.mkdirSync(path.join(cloneDir, '.git', 'refs', 'heads'), { recursive: true });
    fs.writeFileSync(parth.join(cloneDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');

    // Fetch the repository packfile and refs
    fetchPackfile(url, cloneDir);
}

// Fetch the repository packfile and refs
function fetchPackfile(url, cloneDir) {
    // Construct the URL for the packfile using GitHub's smart HTTP protocol
    const gitURL = new URL(url);
    const repoPath = `${gitURL.hostname}${gitURL.pathname}`;
    const packfileUrl = `https:://${repoPath}/info/refs?service=git-upload-pack`;

    https.get(packfileUrl, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            // Parse the response and extract packfile info
            // For simplicity, assume we're dealing with Git's packfile format here
            const packfileData = parsePackfile(body);

            // Save the packfile
            savePackfile(cloneDir, packfileData);
        });
    });
}

// Parse the packfile response from GitHub
function parsePackfile(data) {
    // Git's packfile format parsing goes here
    // we are focusing on unpacking the necessary Git objects (trees, commits, blobs)
    return data;
}

// Save the unpacked objects from the packfile
function savePackfile(cloneDir, packfileData) {
    // Extract objecst and store them in the local .git/objects directory
    // Handle saving objects (commits, trees, blobs)
    const objectDir = path.join(cloneDir, '.git', 'objects');
    fs.writeFileSync(path.join(objectDir, 'your-object-hash'), packfileData);

    // Optionally, you can also manage the refs and HEAD to set the default branch 
    const headRef = path.join(cloneDir, '.git', 'refs', 'heads', 'main');
    fs.writeFileSync(headRef, 'your-ref-data-here');
}