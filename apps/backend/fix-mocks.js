const fs = require('fs');
const path = require('path');

// Files to process - these have mocked models/utilities that need fixing
const filePatterns = [
  { file: 'src/services/profile.service.test.ts', type: 'models' },
  { file: 'src/services/leave.service.test.ts', type: 'models' },
  { file: 'src/services/userManagement.service.test.ts', type: 'models' },
];

filePatterns.forEach(({ file, type }) => {
  console.log(`\nProcessing: ${file}`);
  let content = fs.readFileSync(file, 'utf8');
  
  // This is a smarter replacement:
  // vi.spyOn(Model.method) -> vi.spyOn(Model, 'method')
  
  // Pattern for model methods like: User.findByPk, Employee.create, etc.
  content = content.replace(/vi\.spyOn\((\w+)\.(\w+)\)/g, "vi.spyOn($1, '$2')");
  
  fs.writeFileSync(file, content);
  console.log(`✓ Fixed method calls in ${file}`);
});
