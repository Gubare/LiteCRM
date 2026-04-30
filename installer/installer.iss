[Setup]
AppName=CRM для малого бизнеса
AppVersion=1.0.0
AppPublisher=Your Name
DefaultDirName={autopf}\CRMApp
DefaultGroupName=CRM App
OutputDir=..\output\installer
OutputBaseFilename=CRM-Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"


[Files]
; Копируем исполняемый файл Windows
Source: "..\bin\neutralino-win_x64.exe"; DestDir: "{app}"; DestName: "crm-app.exe"; Flags: ignoreversion

[Icons]
Name: "{group}\CRM для малого бизнеса"; Filename: "{app}\crm-app.exe"
Name: "{autodesktop}\CRM для малого бизнеса"; Filename: "{app}\crm-app.exe"
Name: "{userprograms}\CRM"; Filename: "{app}\crm-app.exe"

[Run]
Filename: "{app}\crm-app.exe"; Description: "{cm:LaunchProgram,CRM для малого бизнеса}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"