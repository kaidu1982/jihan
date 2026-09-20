# 구름 위 계단 · 배경 음악

2026-09-20 지한이의 작은 오락실을 위해 작성한 멜로디와 합성 악기 음원입니다. 외부 녹음, 음원 파일, 샘플, 음악 생성 서비스는 사용하지 않았습니다. 두 곡은 같은 주제를 서로 다른 템포와 악기 편성으로 연주합니다.

| 게임 모드 | 곡 | 템포 | 반복 길이 | 24초 미리듣기 |
| --- | --- | --- | --- | --- |
| 도전 | 통통 구름 | 128 BPM | 32마디 · 60초 | [WAV](cloud-steps-128-preview.wav) |
| 연습 | 포근한 구름 | 104 BPM | 32마디 · 약 73.85초 | [WAV](cloud-steps-104-preview.wav) |

## 제작

C장조의 A·A·B·A 구성입니다. 도전곡은 말렛, 짧은 코드, 베이스와 가벼운 타악기로 구성했습니다. 연습곡은 배음을 줄인 부드러운 멜로디와 성긴 반주를 사용합니다. 웹게임에서는 효과음이 잘 들리도록 배경 음악의 재생 음량을 낮춥니다.

작곡과 렌더링 소스는 [scripts/compose-music.py](../../scripts/compose-music.py)입니다. 무작위 타악기 합성에는 고정된 시드를 사용합니다. Python 3와 NumPy가 있는 환경에서 프로젝트 루트 기준으로 실행합니다.

```sh
python3 scripts/compose-music.py
```

44.1kHz·16bit·스테레오 WAV 원본은 Git에서 제외한 `.local/audio-masters/`에 생성합니다. 배포 음원은 macOS의 AAC 인코더로 128kbps로 변환했습니다.

```sh
afconvert -f m4af -d aac -b 128000 .local/audio-masters/cloud-steps-128.wav public/audio/cloud-steps-128-v1.m4a
afconvert -f m4af -d aac -b 128000 .local/audio-masters/cloud-steps-104.wav public/audio/cloud-steps-104-v1.m4a
```

곡 변경 시 파일 버전을 올리고 `src/audio.ts`의 경로와 반복 길이를 함께 수정합니다. 미리듣기는 24초 후 서서히 작아지며, 배포 파일은 전체 곡을 반복합니다. 미리듣기 WAV는 공개 사이트 빌드에 포함되지 않습니다.

## 음원 확인

원본 RMS는 두 곡 모두 -19dBFS이며 자세한 측정값은 [music-metrics.json](music-metrics.json)에 있습니다. AAC를 다시 WAV로 풀어 원본과 같은 샘플 길이인지 확인했습니다. 압축 후 피크는 도전 -4.40dBFS, 연습 -5.44dBFS이며 클리핑 샘플은 없습니다. 반복 경계의 샘플 변화량은 각 곡의 일반 구간 변화량 99백분위보다 작습니다. 이는 신호 검사 결과이며, 실제 기기의 스피커·이어폰 음량과 음색은 청취하며 조절할 수 있습니다.
