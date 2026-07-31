"""PhoBERT model with specialty NER, intent and clinical signal heads."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import torch
from torch import nn
from transformers import (
    PreTrainedModel,
    RobertaConfig,
    RobertaModel,
)
from transformers.modeling_outputs import ModelOutput


@dataclass
class MultiTaskOutput(ModelOutput):
    """Output compatible with Trainer plus the clinical extraction heads."""

    loss: Optional[torch.FloatTensor] = None
    # ``logits`` is the NER output expected by the Hugging Face Trainer.
    logits: Optional[torch.FloatTensor] = None
    intent_logits: Optional[torch.FloatTensor] = None
    slot_logits: Optional[torch.FloatTensor] = None
    risk_logits: Optional[torch.FloatTensor] = None
    hidden_states: Optional[Tuple[torch.FloatTensor, ...]] = None
    attentions: Optional[Tuple[torch.FloatTensor, ...]] = None


class MultiTaskRobertaForTokenAndIntentClassification(PreTrainedModel):
    """Shared PhoBERT encoder with specialty, slot, intent and risk heads."""

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
        self.slot_num_labels = int(getattr(config, "slot_num_labels", 7))
        self.risk_num_labels = int(getattr(config, "risk_num_labels", 5))

        self.roberta = RobertaModel(config, add_pooling_layer=False)
        self.dropout = nn.Dropout(config.hidden_dropout_prob)
        self.ner_classifier = nn.Linear(config.hidden_size, self.num_labels)
        self.intent_classifier = nn.Linear(config.hidden_size, self.intent_num_labels)
        self.slot_classifier = nn.Linear(config.hidden_size, self.slot_num_labels)
        self.risk_classifier = nn.Linear(config.hidden_size, self.risk_num_labels)

        class_weights = getattr(config, "intent_class_weights", None)
        if class_weights is None:
            class_weights = [1.0] * self.intent_num_labels
        self.register_buffer(
            "intent_class_weights",
            torch.tensor(class_weights, dtype=torch.float),
            persistent=True,
        )
        self.intent_loss_weight = float(getattr(config, "intent_loss_weight", 1.0))
        self.slot_loss_weight = float(getattr(config, "slot_loss_weight", 1.0))
        self.risk_loss_weight = float(getattr(config, "risk_loss_weight", 1.5))
        self.post_init()

    def get_input_embeddings(self):
        return self.roberta.embeddings.word_embeddings

    def set_input_embeddings(self, value):
        self.roberta.embeddings.word_embeddings = value

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
        slot_labels: Optional[torch.LongTensor] = None,
        risk_labels: Optional[torch.FloatTensor] = None,
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
        slot_logits = self.slot_classifier(sequence_output)
        risk_logits = self.risk_classifier(sequence_output[:, 0, :])

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

        if slot_labels is not None:
            slot_loss = nn.CrossEntropyLoss(ignore_index=-100)(
                slot_logits.reshape(-1, self.slot_num_labels), slot_labels.reshape(-1)
            )
            loss = slot_loss * self.slot_loss_weight if loss is None else loss + slot_loss * self.slot_loss_weight

        if risk_labels is not None:
            risk_loss = nn.BCEWithLogitsLoss()(risk_logits, risk_labels.float())
            loss = risk_loss * self.risk_loss_weight if loss is None else loss + risk_loss * self.risk_loss_weight

        if not return_dict:
            output = (ner_logits, intent_logits, slot_logits, risk_logits) + outputs[2:]
            return ((loss,) + output) if loss is not None else output

        return MultiTaskOutput(
            loss=loss,
            logits=ner_logits,
            intent_logits=intent_logits,
            slot_logits=slot_logits,
            risk_logits=risk_logits,
            hidden_states=outputs.hidden_states,
            attentions=outputs.attentions,
        )
