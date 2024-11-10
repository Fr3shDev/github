const fs = require("fs");
const path = require("path");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.error("Logs from your program will appear here!");

const command = process.argv[2];

switch (command) {
    case "init":
    createGitDirectory();
    break;
    case 'ls-tree':
        const treeHash = process.argv[3];
        lsTree(treeHash);
        break;
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