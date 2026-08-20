"use client";

import type { MDXComponents } from "mdx/types";
import { AnswerList } from "./answer-list";
import { ProductQuestions } from "./product-questions";
import { QuestionCard } from "./question-card";
import { QuestionForm } from "./question-form";

export { AnswerList, ProductQuestions, QuestionCard, QuestionForm };

export default {
	AnswerList,
	ProductQuestions,
	QuestionCard,
	QuestionForm,
} satisfies MDXComponents;
