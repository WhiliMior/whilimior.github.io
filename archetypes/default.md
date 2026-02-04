---
title: {{ replace .TranslationBaseName "-" " " | title }}
date: {{ .Date }}
slug: {{ substr .File.UniqueID 0 7 }}
tags:
categories:
---
