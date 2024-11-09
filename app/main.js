const fs = require("fs");
const path = require("path");

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