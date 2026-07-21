"""PhoBERT model with shared NER and sentence-intent classification heads."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import torch
from torch import nn
from transformers import (
    AutoModelForTokenClassification,
    PreTrainedModel,
    RobertaConfig,
    RobertaModel,
)
from transformers.modeling_outputs import ModelOutput


@dataclass
class MultiTaskOutput(ModelOutput):
    """Output compatible with Trainer plus an additional intent head."""

    loss: Optional[torch.FloatTensor] = None
    # ``logits`` is the NER output expected by the Hugging Face Trainer.
    logits: Optional[torch.FloatTensor] = None
    intent_logits: Optional[torch.FloatTensor] = None
    hidden_states: Optional[Tuple[torch.FloatTensor, ...]] = None
    attentions: Optional[Tuple[torch.FloatTensor, ...]] = None


class MultiTaskRobertaForTokenAndIntentClassification(PreTrainedModel):
    """A shared PhoBERT encoder with token and sequence classification heads."""

    config_class = RobertaConfig
    base_model_prefix = "roberta"
    main_input_name = "input_ids"

    def __init__(self, config):
        # Transformers 5.x defaults to SDPA, while this custom architecture
        # currently supports the eager attention implementation.
        if hasattr(config, "_attn_implementation"):
            config._attn_implementation = "eager"
        super().__init__(config)
        self.num_labels = int(config.num_labels)
        self.intent_num_labels = int(config.intent_num_labels)

        self.roberta = RobertaModel(config, add_pooling_layer=False)
        self.dropout = nn.Dropout(config.hidden_dropout_prob)
        self.ner_classifier = nn.Linear(config.hidden_size, self.num_labels)
        self.intent_classifier = nn.Linear(config.hidden_size, self.intent_num_labels)

        class_weights = getattr(config, "intent_class_weights", None)
        if class_weights is None:
            class_weights = [1.0] * self.intent_num_labels
        self.register_buffer(
            "intent_class_weights",
            torch.tensor(class_weights, dtype=torch.float),
            persistent=True,
        )
        self.intent_loss_weight = float(getattr(config, "intent_loss_weight", 1.0))
        self.post_init()

    def get_input_embeddings(self):
        return self.roberta.embeddings.word_embeddings

    def set_input_embeddings(self, value):
        self.roberta.embeddings.word_embeddings = value

    @classmethod
    def from_ner_checkpoint(
        cls,
        model_path: str,
        intent_num_labels: int,
        intent_label2id: dict[str, int],
        intent_id2label: dict[int, str],
        intent_class_weights: list[float],
    ) -> "MultiTaskRobertaForTokenAndIntentClassification":
        """Create the multi-task model while retaining the old NER weights."""

        old_model = AutoModelForTokenClassification.from_pretrained(model_path)
        config = old_model.config
        config.intent_num_labels = intent_num_labels
        config.intent_label2id = intent_label2id
        config.intent_id2label = intent_id2label
        config.intent_class_weights = intent_class_weights
        config.intent_loss_weight = 1.0

        model = cls(config)
        old_base = getattr(old_model, old_model.base_model_prefix)
        model.roberta.load_state_dict(old_base.state_dict())
        model.ner_classifier.load_state_dict(old_model.classifier.state_dict())
        return model

    def forward(
        self,
        input_ids: Optional[torch.LongTensor] = None,
        attention_mask: Optional[torch.Tensor] = None,
        token_type_ids: Optional[torch.LongTensor] = None,
        position_ids: Optional[torch.LongTensor] = None,
        head_mask: Optional[torch.Tensor] = None,
        inputs_embeds: Optional[torch.FloatTensor] = None,
        labels: Optional[torch.LongTensor] = None,
        intent_labels: Optional[torch.LongTensor] = None,
        output_attentions: Optional[bool] = None,
        output_hidden_states: Optional[bool] = None,
        return_dict: Optional[bool] = None,
    ) -> MultiTaskOutput | tuple:
        return_dict = return_dict if return_dict is not None else self.config.use_return_dict

        outputs = self.roberta(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
            position_ids=position_ids,
            head_mask=head_mask,
            inputs_embeds=inputs_embeds,
            output_attentions=output_attentions,
            output_hidden_states=output_hidden_states,
            return_dict=True,
        )

        sequence_output = self.dropout(outputs.last_hidden_state)
        ner_logits = self.ner_classifier(sequence_output)
        intent_logits = self.intent_classifier(sequence_output[:, 0, :])

        loss = None
        if labels is not None:
            ner_loss = nn.CrossEntropyLoss(ignore_index=-100)(
                ner_logits.reshape(-1, self.num_labels), labels.reshape(-1)
            )
            loss = ner_loss

        if intent_labels is not None:
            intent_loss = nn.CrossEntropyLoss(weight=self.intent_class_weights)(
                intent_logits.reshape(-1, self.intent_num_labels),
                intent_labels.reshape(-1),
            )
            loss = intent_loss * self.intent_loss_weight if loss is None else loss + intent_loss * self.intent_loss_weight

        if not return_dict:
            output = (ner_logits, intent_logits) + outputs[2:]
            return ((loss,) + output) if loss is not None else output

        return MultiTaskOutput(
            loss=loss,
            logits=ner_logits,
            intent_logits=intent_logits,
            hidden_states=outputs.hidden_states,
            attentions=outputs.attentions,
        )
