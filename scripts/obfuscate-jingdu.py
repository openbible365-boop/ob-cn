#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import base64
import json

# 密钥：位异或 0x2A (42)
XOR_KEY = 0x2A

def obfuscate(data_str: str) -> str:
    # 1. Base64 encode
    b64_bytes = base64.b64encode(data_str.encode('utf-8'))
    b64_str = b64_bytes.decode('ascii')
    # 2. XOR character-by-character
    obfuscated = "".join(chr(ord(c) ^ XOR_KEY) for c in b64_str)
    return obfuscated

def deobfuscate(obfuscated_str: str) -> str:
    # 1. XOR character-by-character back
    b64_str = "".join(chr(ord(c) ^ XOR_KEY) for c in obfuscated_str)
    # 2. Base64 decode
    b64_bytes = b64_str.encode('ascii')
    raw_bytes = base64.b64decode(b64_bytes)
    return raw_bytes.decode('utf-8')

def main():
    decrypt_mode = "--decrypt" in sys.argv or "-d" in sys.argv
    
    # 找到 data/commentary/jingdu 文件夹
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.abspath(os.path.join(script_dir, "..", "data", "commentary", "jingdu"))
    
    if not os.path.exists(data_dir):
        print(f"Error: Directory not found at {data_dir}", file=sys.stderr)
        sys.exit(1)
        
    print(f"Target directory: {data_dir}")
    print(f"Mode: {'DECRYPT' if decrypt_mode else 'OBFUSCATE'}")
    
    files = [f for f in os.listdir(data_dir) if f.endswith(".json")]
    processed_count = 0
    
    for f in sorted(files, key=lambda x: int(os.path.splitext(x)[0]) if os.path.splitext(x)[0].isdigit() else 999):
        filepath = os.path.join(data_dir, f)
        with open(filepath, "r", encoding="utf-8") as file_obj:
            content = file_obj.read()
            
        is_json = content.strip().startswith("{")
        
        if decrypt_mode:
            if is_json:
                # 已经是明文，跳过
                continue
            try:
                decrypted = deobfuscate(content)
                # 格式化一下写入
                parsed = json.loads(decrypted)
                with open(filepath, "w", encoding="utf-8") as file_obj:
                    json.dump(parsed, file_obj, ensure_ascii=False, indent=2)
                processed_count += 1
            except Exception as e:
                print(f"Error decrypting {f}: {e}", file=sys.stderr)
        else:
            if not is_json:
                # 已经加密，跳过
                continue
            try:
                # 压缩成无空格单行 JSON 再混淆，节省一点传输体积
                parsed = json.loads(content)
                compact_str = json.dumps(parsed, ensure_ascii=False, separators=(',', ':'))
                obfuscated = obfuscate(compact_str)
                with open(filepath, "w", encoding="utf-8") as file_obj:
                    file_obj.write(obfuscated)
                processed_count += 1
            except Exception as e:
                print(f"Error obfuscating {f}: {e}", file=sys.stderr)
                
    print(f"Successfully processed {processed_count} files.")

if __name__ == "__main__":
    main()
